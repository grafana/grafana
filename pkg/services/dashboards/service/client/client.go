package client

import (
	"context"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	// maxConcurrentGetRequests is the maximum number of concurrent Get requests to the K8s API.
	// It is used to determine max amount of concurrent version fallback requests when handling a List request.
	// TODO: do we need to make this configurable via config.ini?
	maxConcurrentGetRequests = 10
)

// K8sHandlerWithFallback is a wrapper around the K8sHandler that provides a fallback to the stored version.
type K8sHandlerWithFallback interface {
	client.K8sHandler
}

// K8sClientFactory creates a K8sHandler for a given version.
type K8sClientFactory func(ctx context.Context, version string) client.K8sHandler

// K8sClientWithFallback is a wrapper around the K8sHandler that provides a fallback to the stored version.
type K8sClientWithFallback struct {
	client.K8sHandler

	newClientFunc K8sClientFactory
	metrics       *k8sClientMetrics
	log           log.Logger
}

// ProvideK8sClientWithFallback provides a K8sHandlerWithFallback.
func ProvideK8sClientWithFallback(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
	dashboardStore dashboards.Store,
	userService user.Service,
	resourceClient resource.ResourceClient,
	featureToggles featuremgmt.FeatureToggles,
	dualWriter dualwrite.Service,
	sorter sort.Service,
	reg prometheus.Registerer,
) K8sHandlerWithFallback {
	return NewK8sClientWithFallback(
		cfg, restConfigProvider, dashboardStore, userService, resourceClient, sorter, dualWriter, reg, featureToggles,
	)
}

// NewK8sClientWithFallback creates a new K8sClientWithFallback.
func NewK8sClientWithFallback(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
	dashboardStore dashboards.Store,
	userService user.Service,
	resourceClient resource.ResourceClient,
	sorter sort.Service,
	dual dualwrite.Service,
	reg prometheus.Registerer,
	features featuremgmt.FeatureToggles,
) *K8sClientWithFallback {
	newClientFunc := newK8sClientFactory(cfg, restConfigProvider, dashboardStore, userService, resourceClient, sorter, dual, features)
	return &K8sClientWithFallback{
		K8sHandler:    newClientFunc(context.Background(), dashboardv0.VERSION),
		newClientFunc: newClientFunc,
		metrics:       newK8sClientMetrics(reg),
		log:           log.New("dashboards-k8s-client"),
	}
}

// Get gets a resource from the K8s API.
// If the resource indicates that it was stored using a different version, the client will re-fetch it using the stored version.
func (h *K8sClientWithFallback) Get(
	ctx context.Context, name string, orgID int64, options metav1.GetOptions, subresources ...string,
) (*unstructured.Unstructured, error) {
	spanCtx, span := tracing.Start(ctx, "K8sClientWithFallback.Get")
	defer span.End()

	span.SetAttributes(
		attribute.String("dashboard.metadata.name", name),
		attribute.Int64("org.id", orgID),
		attribute.Bool("fallback", false),
	)

	span.AddEvent("v0alpha1 Get")
	result, err := h.K8sHandler.Get(spanCtx, name, orgID, options, subresources...)
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	failed, storedVersion, conversionErr := getConversionStatus(result)
	if !failed {
		// if the conversion did not fail, there is no need to fallback.
		return result, nil
	}

	h.log.Info("falling back to stored version", "name", name, "storedVersion", storedVersion, "conversionErr", conversionErr)
	h.metrics.fallbackCounter.WithLabelValues(storedVersion).Inc()

	span.SetAttributes(
		attribute.Bool("fallback", true),
		attribute.String("fallback.stored_version", storedVersion),
		attribute.String("fallback.conversion_error", conversionErr),
	)

	span.AddEvent(fmt.Sprintf("%s Get", storedVersion))
	return h.newClientFunc(spanCtx, storedVersion).Get(spanCtx, name, orgID, options, subresources...)
}

type nameAndResourceVersion struct {
	Name            string
	ResourceVersion string
}

// List lists resources from the K8s API.
// It will check individual resources and re-fetch them if necessary.
func (h *K8sClientWithFallback) List(
	ctx context.Context, orgID int64, options metav1.ListOptions,
) (*unstructured.UnstructuredList, error) {
	ctx, span := tracing.Start(ctx, "K8sClientWithFallback.List")
	defer span.End()

	span.SetAttributes(
		attribute.Int64("org.id", orgID),
		attribute.Bool("fallback", false),
	)

	span.AddEvent("List")
	initial, err := h.K8sHandler.List(ctx, orgID, options)
	if err != nil {
		h.log.Error("failed to fetch initial list", "error", err)
		return nil, tracing.Error(span, err)
	}

	res := initial.DeepCopy()
	res.Items = res.Items[:0]

	// Map of version -> list of names to fetch.
	toFetch := make(map[string][]nameAndResourceVersion)

	for _, item := range initial.Items {
		failed, storedVersion, conversionErr := getConversionStatus(&item)
		if !failed {
			res.Items = append(res.Items, item)
			continue
		}

		h.log.Debug(
			"will fetch object with the stored version",
			"name", item.GetName(),
			"storedVersion", storedVersion,
			"conversionErr", conversionErr,
		)
		h.metrics.fallbackCounter.WithLabelValues(storedVersion).Inc()

		names, ok := toFetch[storedVersion]
		if !ok {
			names = make([]nameAndResourceVersion, 0)
		}

		names = append(names, nameAndResourceVersion{
			Name:            item.GetName(),
			ResourceVersion: item.GetResourceVersion(),
		})
		toFetch[storedVersion] = names
	}

	for version, names := range toFetch {
		h.log.Info(
			"fetching multiple objects with the stored version",
			"version", version,
		)

		// Log names at debug level, because there could be a lot of them.
		h.log.Debug(
			"will fetch objects with names",
			"names", names,
		)

		items, err := h.fetchWithVersion(ctx, orgID, version, names...)
		if err != nil {
			return nil, tracing.Error(span, err)
		}

		res.Items = append(res.Items, items...)
	}

	return res, nil
}

// fetchWithVersion fetches multiple resources from the K8s API.
// It uses concurrent Get requests, one for each name.
//
// TODO: maybe consider using List with a field selector and / or search?
//
//	items, err := client.List(spanCtx, orgID, metav1.ListOptions{
//		FieldSelector: fmt.Sprintf("metadata.name in (%s)", strings.Join(names, ",")),
//	})
func (h *K8sClientWithFallback) fetchWithVersion(
	ctx context.Context, orgID int64, version string, items ...nameAndResourceVersion,
) ([]unstructured.Unstructured, error) {
	ctx, span := tracing.Start(ctx, "K8sClientWithFallback.fetchWithVersion")
	defer span.End()

	span.SetAttributes(
		attribute.String("version", version),
		attribute.Int("count", len(items)),
	)

	client := h.newClientFunc(ctx, version)

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrentGetRequests)
	res := make([]unstructured.Unstructured, len(items))

	for i, it := range items {
		g.Go(func() error {
			ctx, span := tracing.Start(ctx, "K8sClientWithFallback.fetchWithVersion.ConcurrentGet")
			defer span.End()

			span.SetAttributes(
				attribute.String("name", it.Name),
				attribute.String("resourceVersion", it.ResourceVersion),
			)

			item, err := client.Get(ctx, it.Name, orgID, metav1.GetOptions{
				ResourceVersion: it.ResourceVersion,
			})
			if err != nil {
				return tracing.Error(span, err)
			}

			// NB: it's important to set via the index,
			// because `append`ing would create a race condition.
			res[i] = *item

			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, tracing.Error(span, err)
	}

	return res, nil
}

func getConversionStatus(obj *unstructured.Unstructured) (failed bool, storedVersion string, conversionErr string) {
	status, found, _ := unstructured.NestedMap(obj.Object, "status")
	if !found {
		return false, "", ""
	}
	conversionStatus, found, _ := unstructured.NestedMap(status, "conversion")
	if !found {
		return false, "", ""
	}
	failed, _, _ = unstructured.NestedBool(conversionStatus, "failed")
	storedVersion, _, _ = unstructured.NestedString(conversionStatus, "storedVersion")
	conversionErr, _, _ = unstructured.NestedString(conversionStatus, "error")
	return failed, storedVersion, conversionErr
}

func newK8sClientFactory(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
	dashboardStore dashboards.Store,
	userService user.Service,
	resourceClient resource.ResourceClient,
	sorter sort.Service,
	dual dualwrite.Service,
	features featuremgmt.FeatureToggles,
) K8sClientFactory {
	clientCache := make(map[string]client.K8sHandler)
	cacheMutex := &sync.RWMutex{}
	return func(ctx context.Context, version string) client.K8sHandler {
		_, span := tracing.Start(ctx, "k8sClientFactory.GetClient",
			attribute.String("group", dashboardv0.GROUP),
			attribute.String("version", version),
			attribute.String("resource", "dashboards"),
		)
		defer span.End()

		cacheMutex.RLock()
		cachedClient, exists := clientCache[version]
		cacheMutex.RUnlock()

		if exists {
			span.AddEvent("Client found in cache")
			return cachedClient
		}

		cacheMutex.Lock()
		defer cacheMutex.Unlock()

		// check again in case another goroutine created in between locks
		cachedClient, exists = clientCache[version]
		if exists {
			span.AddEvent("Client found in cache after lock")
			return cachedClient
		}

		gvr := schema.GroupVersionResource{
			Group:    dashboardv0.GROUP,
			Version:  version,
			Resource: "dashboards",
		}

		span.AddEvent("Creating new client")
		newClient := client.NewK8sHandler(dual, request.GetNamespaceMapper(cfg), gvr, restConfigProvider.GetRestConfig, dashboardStore, userService, resourceClient, sorter, features)
		clientCache[version] = newClient

		return newClient
	}
}

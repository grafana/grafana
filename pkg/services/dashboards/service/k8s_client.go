package service

import (
	"context"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardv1alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type k8sHandlerFactory func(ctx context.Context, version string) client.K8sHandler

type k8sHandlerWithFallback struct {
	client.K8sHandler

	newClientFunc k8sHandlerFactory
	log           log.Logger
}

func NewK8sHandlerWithFallback(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
	dashboardStore dashboards.Store,
	userService user.Service,
	resourceClient resource.ResourceClient,
	sorter sort.Service,
	dual dualwrite.Service,
	parentLogger log.Logger,
) client.K8sHandler {
	newClientFunc := newK8sHandlerFactory(
		cfg,
		restConfigProvider,
		dashboardStore,
		userService,
		resourceClient,
		sorter,
		dual,
	)

	// Create the default client with a background context
	defaultClient := newClientFunc(context.Background(), dashboardv1alpha1.VERSION)

	return &k8sHandlerWithFallback{
		K8sHandler:    defaultClient,
		newClientFunc: newClientFunc,
		log:           parentLogger.New("k8s.dashboards.fallback"),
	}
}

func (h *k8sHandlerWithFallback) Get(ctx context.Context, name string, orgID int64, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	ctx, span := tracing.Start(ctx, "versionFallbackK8sHandler.Get")
	defer span.End()

	span.SetAttributes(
		attribute.String("dashboard.metadata.name", name),
		attribute.Int64("org.id", orgID),
		attribute.Bool("fallback", false),
	)

	span.AddEvent("v1alpha1 Get")
	result, err := h.K8sHandler.Get(ctx, name, orgID, options, subresources...)
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	failed, storedVersion, conversionErr := getConversionStatus(result)
	if !failed {
		// if the conversion did not fail, there is no need to fallback.
		return result, nil
	}

	h.log.Debug("falling back to stored version", "name", name, "storedVersion", storedVersion, "conversionErr", conversionErr)
	span.SetAttributes(
		attribute.Bool("fallback", true),
		attribute.String("fallback.stored_version", storedVersion),
		attribute.String("fallback.conversion_error", conversionErr),
	)

	span.AddEvent(fmt.Sprintf("%s Get", storedVersion))
	return h.newClientFunc(ctx, storedVersion).Get(ctx, name, orgID, options, subresources...)
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

func newK8sHandlerFactory(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
	dashboardStore dashboards.Store,
	userService user.Service,
	resourceClient resource.ResourceClient,
	sorter sort.Service,
	dual dualwrite.Service,
) k8sHandlerFactory {
	clientCache := make(map[string]client.K8sHandler)
	cacheMutex := &sync.RWMutex{}
	return func(ctx context.Context, version string) client.K8sHandler {
		ctx, span := tracing.Start(ctx, "k8sClientFactory.GetClient",
			attribute.String("group", dashboardv1alpha1.GROUP),
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
			Group:    dashboardv1alpha1.GROUP,
			Version:  version,
			Resource: "dashboards",
		}

		span.AddEvent("Creating new client")
		newClient := client.NewK8sHandler(dual, request.GetNamespaceMapper(cfg), gvr, restConfigProvider.GetRestConfig, dashboardStore, userService, resourceClient, sorter)
		clientCache[version] = newClient

		return newClient
	}
}

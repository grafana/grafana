package resourcepermission

import (
	"context"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

// NameResolver translates between K8s UIDs and DB numeric IDs for a specific resource type.
// Resources without a resolver (folders, dashboards) pass names through unchanged since they
// already use UIDs as their scope attribute.
type NameResolver interface {
	// UIDToID converts a K8s UID to a DB numeric ID string.
	// Used on the write path before generating a legacy RBAC scope.
	// Returns an error if the UID does not exist — callers must fail fast.
	UIDToID(ctx context.Context, namespace string, uid string) (string, error)

	// IDToUID converts a DB numeric ID string to a K8s UID.
	// Used on the read path to rewrite DB scopes back to K8s API names.
	IDToUID(ctx context.Context, namespace string, id string) (string, error)

	// IDToUIDMap returns the full ID→UID mapping for a namespace in one K8s API call.
	// Prefer this over IDToUID in a loop when resolving bulk read responses.
	IDToUIDMap(ctx context.Context, namespace string) (map[string]string, error)
}

// serviceAccountNameResolver resolves UID↔ID for service accounts via the K8s API.
// Using K8s API calls (rather than a direct DB lookup) is mode-agnostic: requests
// route through whatever storage backend (dualwrite, unified, legacy) the SA resource
// is currently configured for.
//
// The SA client is created lazily on first use via sync.Once so that the resolver
// can be safely constructed during Wire init (before the apiserver rest config is ready).
type serviceAccountNameResolver struct {
	generator  resource.ClientGenerator
	tracer     trace.Tracer
	logger     log.Logger
	clientOnce sync.Once
	client     *iamv0alpha1.ServiceAccountClient
	clientErr  error
}

// NewServiceAccountNameResolver creates a NameResolver for service accounts that
// translates between K8s UIDs and DB numeric IDs via the K8s API.
// The generator must be lazy (i.e. it may block until the apiserver is ready).
func NewServiceAccountNameResolver(generator resource.ClientGenerator, tracer trace.Tracer) NameResolver {
	return &serviceAccountNameResolver{
		generator: generator,
		tracer:    tracer,
		logger:    log.New("resourceperm.sa-name-resolver"),
	}
}

// getClient initialises the SA K8s client on the first call.
// Subsequent calls return the cached result. Safe for concurrent use.
func (r *serviceAccountNameResolver) getClient() (*iamv0alpha1.ServiceAccountClient, error) {
	r.clientOnce.Do(func() {
		c, err := r.generator.ClientFor(iamv0alpha1.ServiceAccountKind())
		if err != nil {
			r.clientErr = fmt.Errorf("creating service account K8s client: %w", err)
			return
		}
		r.client = iamv0alpha1.NewServiceAccountClient(c)
	})
	return r.client, r.clientErr
}

// UIDToID fetches the service account by UID and reads its deprecatedInternalID label
// to return the DB numeric ID string. Fails fast if the UID is not found.
func (r *serviceAccountNameResolver) UIDToID(ctx context.Context, namespace, uid string) (string, error) {
	ctx, span := r.tracer.Start(ctx, "serviceAccountNameResolver.UIDToID",
		trace.WithAttributes(
			attribute.String("namespace", namespace),
			attribute.String("uid", uid),
		),
	)
	defer span.End()

	client, err := r.getClient()
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		return "", err
	}
	sa, err := client.Get(ctx, resource.Identifier{Namespace: namespace, Name: uid})
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		r.logger.FromContext(ctx).Warn("failed to get service account by uid", "namespace", namespace, "uid", uid, "error", err)
		if apierrors.IsNotFound(err) {
			return "", serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with uid %q not found in namespace %q", uid, namespace)
		}
		return "", fmt.Errorf("resolving service account uid %q to id: %w", uid, err)
	}

	id := sa.GetLabels()[utils.LabelKeyDeprecatedInternalID]
	if id == "" {
		err := fmt.Errorf("service account %q in namespace %q is missing label %s", uid, namespace, utils.LabelKeyDeprecatedInternalID)
		span.SetStatus(codes.Error, err.Error())
		r.logger.FromContext(ctx).Warn("service account missing deprecatedInternalID label", "namespace", namespace, "uid", uid)
		return "", err
	}

	span.SetAttributes(attribute.String("id", id))
	r.logger.FromContext(ctx).Debug("resolved uid to id", "namespace", namespace, "uid", uid, "id", id)
	return id, nil
}

// IDToUID lists service accounts filtered by deprecatedInternalID label and returns
// the metadata.name (UID) of the matching entry.
func (r *serviceAccountNameResolver) IDToUID(ctx context.Context, namespace, id string) (string, error) {
	ctx, span := r.tracer.Start(ctx, "serviceAccountNameResolver.IDToUID",
		trace.WithAttributes(
			attribute.String("namespace", namespace),
			attribute.String("id", id),
		),
	)
	defer span.End()

	client, err := r.getClient()
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		return "", err
	}
	list, err := client.List(ctx, namespace, resource.ListOptions{
		LabelFilters: []string{utils.LabelKeyDeprecatedInternalID + "=" + id},
	})
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		r.logger.FromContext(ctx).Warn("failed to list service accounts by id", "namespace", namespace, "id", id, "error", err)
		return "", fmt.Errorf("resolving service account id %q to uid: %w", id, err)
	}

	if len(list.Items) == 0 {
		span.SetStatus(codes.Error, "not found")
		r.logger.FromContext(ctx).Warn("no service account found for id", "namespace", namespace, "id", id)
		return "", serviceaccounts.ErrServiceAccountNotFound.Errorf("service account with id %q not found in namespace %q", id, namespace)
	}

	uid := list.Items[0].GetName()
	span.SetAttributes(attribute.String("uid", uid))
	r.logger.FromContext(ctx).Debug("resolved id to uid", "namespace", namespace, "id", id, "uid", uid)
	return uid, nil
}

// IDToUIDMap lists all service accounts in the namespace and returns a map of
// DB numeric ID → K8s UID. Use this for bulk read operations to avoid N individual
// K8s API calls.
//
// Caching note: a short-lived per-namespace cache would eliminate most K8s API
// pressure on the read path. Pending team approval before implementing.
func (r *serviceAccountNameResolver) IDToUIDMap(ctx context.Context, namespace string) (map[string]string, error) {
	ctx, span := r.tracer.Start(ctx, "serviceAccountNameResolver.IDToUIDMap",
		trace.WithAttributes(
			attribute.String("namespace", namespace),
		),
	)
	defer span.End()

	client, err := r.getClient()
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	list, err := client.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		r.logger.FromContext(ctx).Warn("failed to list all service accounts", "namespace", namespace, "error", err)
		return nil, fmt.Errorf("building id→uid map for namespace %q: %w", namespace, err)
	}

	m := make(map[string]string, len(list.Items))
	for _, sa := range list.Items {
		id := sa.GetLabels()[utils.LabelKeyDeprecatedInternalID]
		if id == "" {
			continue
		}
		m[id] = sa.GetName()
	}

	span.SetAttributes(attribute.Int("count", len(m)))
	r.logger.FromContext(ctx).Debug("built id→uid map", "namespace", namespace, "count", len(m))
	return m, nil
}

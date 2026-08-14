package annotation

import (
	"context"
	"fmt"
	"sync"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// NewDashboardFolderResolver returns a DashboardFolderResolver that fetches the dashboard's
// parent folder via dashboard.grafana.app. restConfig is called once (lazily on first request)
// to build the underlying client: loopback in ST, remote URL with token exchange in MT.
func NewDashboardFolderResolver(restConfig func(context.Context) (*rest.Config, error)) DashboardFolderResolver {
	return &dashboardFolderResolver{client: newDashboardClient(restConfig)}
}

// NoopDashboardFolderResolver returns an empty folder for every dashboard. Use when authz is
// bypassed (e.g. --skip-auth in tests) and the folder UID is irrelevant.
type NoopDashboardFolderResolver struct{}

func (NoopDashboardFolderResolver) ResolveFolder(_ context.Context, _, _ string) (string, error) {
	return "", nil
}

type dashboardFolderResolver struct {
	client *dashboardClient
}

func (r *dashboardFolderResolver) ResolveFolder(ctx context.Context, namespace, dashboardUID string) (string, error) {
	nsInfo, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return "", fmt.Errorf("parse namespace %q: %w", namespace, err)
	}

	// The downstream apiserver authorizes the fetch against the service identity, not the caller's -
	// so a viewer without dashboards:read can still resolve the folder for annotation inheritance checks.
	svcCtx := identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)

	dash, err := r.client.Get(svcCtx, namespace, dashboardUID)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return "", nil
		}
		return "", err
	}

	// GetFolder reads metadata.annotations["grafana.app/folder"].
	meta, err := utils.MetaAccessor(dash)
	if err != nil {
		return "", fmt.Errorf("meta accessor for dashboard %q: %w", dashboardUID, err)
	}
	return meta.GetFolder(), nil
}

type dashboardClient struct {
	restConfig func(context.Context) (*rest.Config, error)
	gvr        schema.GroupVersionResource

	mu  sync.Mutex
	dyn dynamic.Interface
}

func newDashboardClient(restConfig func(context.Context) (*rest.Config, error)) *dashboardClient {
	return &dashboardClient{
		restConfig: restConfig,
		gvr:        dashboardv1.DashboardResourceInfo.GroupVersionResource(),
	}
}

func (c *dashboardClient) Get(ctx context.Context, namespace, name string) (*unstructured.Unstructured, error) {
	dyn, err := c.dynamicClient(ctx)
	if err != nil {
		return nil, err
	}
	return dyn.Resource(c.gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
}

// dynamicClient returns the cached dynamic client, building it on first successful call.
// Caching is safe because rest.Config carries only the connection target (host, TLS, transport
// wrapper).
func (c *dashboardClient) dynamicClient(ctx context.Context) (dynamic.Interface, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.dyn != nil {
		return c.dyn, nil
	}
	cfg, err := c.restConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get rest config: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create dashboard client: %w", err)
	}
	c.dyn = dyn
	return dyn, nil
}

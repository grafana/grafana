package api

import (
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	authlib "github.com/grafana/authlib/types"
	dashboardsV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	preferencesV1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/restconfig"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

//go:generate mockery --name K8sClients --structname MockK8sClients --inpackage --filename client_mock.go --with-expecter
type K8sClients interface {
	GetDashboardID(c *contextmodel.ReqContext, uid string) (int64, response.Response)
	GetStars(c *contextmodel.ReqContext) ([]string, error)
	AddStar(c *contextmodel.ReqContext, uid string) error
	RemoveStar(c *contextmodel.ReqContext, uid string) error
}

type k8sClients struct {
	namespacer     authlib.NamespaceFormatter
	configProvider restconfig.DirectRestConfigProvider
}

var (
	_ K8sClients = (*k8sClients)(nil)
)

// GetDashboardID implements the K8sClients interface.
func (k *k8sClients) GetDashboardID(c *contextmodel.ReqContext, uid string) (int64, response.Response) {
	dyn, err := dynamic.NewForConfig(k.configProvider.GetDirectRestConfig(c))
	if err != nil {
		return 0, response.Error(http.StatusInternalServerError, "client config", err)
	}
	client := dyn.Resource(dashboardsV1.GroupVersion.WithResource(dashboardsV1.DASHBOARD_RESOURCE)).Namespace(k.namespacer(c.OrgID))
	obj, err := client.Get(c.Req.Context(), uid, v1.GetOptions{})
	if err != nil {
		return 0, response.Error(http.StatusNotFound, "Dashboard not found", err)
	}
	dash, err := utils.MetaAccessor(obj)
	if err != nil {
		return 0, response.Error(http.StatusInternalServerError, "invalid object", err)
	}
	return dash.GetDeprecatedInternalID(), nil // nolint:staticcheck
}

// GetStars implements K8sClients.
func (k *k8sClients) GetStars(c *contextmodel.ReqContext) ([]string, error) {
	dyn, err := dynamic.NewForConfig(k.configProvider.GetDirectRestConfig(c))
	if err != nil {
		return nil, err
	}
	client := dyn.Resource(preferencesV1.StarsResourceInfo.GroupVersionResource()).Namespace(k.namespacer(c.OrgID))

	ctx := c.Req.Context()
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	obj, _ := client.Get(ctx, "user-"+user.GetIdentifier(), v1.GetOptions{})
	if obj != nil {
		resources, ok, _ := unstructured.NestedSlice(obj.Object, "spec", "resource")
		if ok && resources != nil {
			for _, r := range resources {
				tmp, ok := r.(map[string]any)
				if ok {
					g, _, _ := unstructured.NestedString(tmp, "group")
					k, _, _ := unstructured.NestedString(tmp, "kind")
					if k == "Dashboard" && g == dashboardsV1.APIGroup {
						names, _, _ := unstructured.NestedStringSlice(tmp, "names")
						return names, nil
					}
				}
			}
		}
	}
	return []string{}, nil
}

// AddStar implements K8sClients.
func (k *k8sClients) AddStar(c *contextmodel.ReqContext, uid string) error {
	dyn, err := kubernetes.NewForConfig(k.configProvider.GetDirectRestConfig(c))
	if err != nil {
		return err
	}

	ctx := c.Req.Context()
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	ns := k.namespacer(c.OrgID)

	client := dyn.RESTClient()
	rsp := client.Put().AbsPath(
		"apis", preferencesV1.APIGroup, preferencesV1.APIVersion, "namespaces", ns,
		"stars", "user-"+user.GetIdentifier(),
		"update", dashboardsV1.APIGroup, dashboardsV1.DashboardKind().Kind(), uid,
	).Do(ctx)

	return rsp.Error()
}

// RemoveStar implements K8sClients.
func (k *k8sClients) RemoveStar(c *contextmodel.ReqContext, uid string) error {
	dyn, err := kubernetes.NewForConfig(k.configProvider.GetDirectRestConfig(c))
	if err != nil {
		return err
	}

	ctx := c.Req.Context()
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	ns := k.namespacer(c.OrgID)

	client := dyn.RESTClient()
	rsp := client.Delete().AbsPath(
		"apis", preferencesV1.APIGroup, preferencesV1.APIVersion, "namespaces", ns,
		"stars", "user-"+user.GetIdentifier(),
		"update", dashboardsV1.APIGroup, dashboardsV1.DashboardKind().Kind(), uid,
	).Do(ctx)

	return rsp.Error()
}

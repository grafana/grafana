package queryhistory

import (
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	authlib "github.com/grafana/authlib/types"
	preferencesV1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type k8sClients struct {
	namespacer     authlib.NamespaceFormatter
	configProvider apiserver.DirectRestConfigProvider
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
					if k == "Query" && g == "history.grafana.app" {
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
		"update", "history.grafana.app", "Query", uid,
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
		"update", "history.grafana.app", "Query", uid,
	).Do(ctx)

	return rsp.Error()
}

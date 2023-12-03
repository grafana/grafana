package dashboards

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/app-deployments/v0alpha1"
)

var (
	_ rest.Storage              = (*staticStorage)(nil)
	_ rest.Scoper               = (*staticStorage)(nil)
	_ rest.SingularNameProvider = (*staticStorage)(nil)
	_ rest.Lister               = (*staticStorage)(nil)
)

type staticStorage struct {
	store *genericregistry.Store
	apps  *v0alpha1.AppDeploymentInfoList
}

func (s *staticStorage) New() runtime.Object {
	return &v0alpha1.AppDeploymentInfo{}
}

func (s *staticStorage) Destroy() {}

func (s *staticStorage) NamespaceScoped() bool {
	return false
}

func (s *staticStorage) GetSingularName() string {
	return "app-deployment"
}

func (s *staticStorage) NewList() runtime.Object {
	return &v0alpha1.AppDeploymentInfoList{}
}

func (s *staticStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *staticStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if s.apps == nil {
		// In a real version, this will load from HG API
		s.apps = &v0alpha1.AppDeploymentInfoList{
			Items: []v0alpha1.AppDeploymentInfo{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:              "grafana",
						CreationTimestamp: metav1.Now(),
					},
					Spec: v0alpha1.Info{
						CDN: v0alpha1.ChannelCDN{
							Instant: "https://grafana-assets.grafana.net/grafana/10.3.0-5000",
							Fast:    "https://grafana-assets.grafana.net/grafana/10.3.0-5000",
							Steady:  "https://grafana-assets.grafana.net/grafana/10.3.0-4000",
							Slow:    "https://grafana-assets.grafana.net/grafana/10.2.0-1234",
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:              "grafana-incident-app",
						CreationTimestamp: metav1.Now(),
					},
					Spec: v0alpha1.Info{
						CDN: v0alpha1.ChannelCDN{
							Instant: "https://grafana-assets.grafana.net/grafana-incident-app/vXXXXX",
							Fast:    "https://grafana-assets.grafana.net/grafana-incident-app/vXXXXX",
							Steady:  "https://grafana-assets.grafana.net/grafana-incident-app/vXXXXX",
							Slow:    "https://grafana-assets.grafana.net/grafana-incident-app/vXXXXX",
						},
					},
				},
			},
		}
	}
	return s.apps, nil
}

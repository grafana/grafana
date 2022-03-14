package datasource

import (
	"testing"

	"github.com/grafana/grafana/internal/components/store"
	"github.com/grafana/grafana/internal/components/testinfra"
	"github.com/grafana/grafana/internal/k8sbridge"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestDatasource(t *testing.T) {
	testCompCfg := testinfra.TestCompCfg{
		GroupVersion: schema.GroupVersion{Group: "grafana.core.group", Version: "v1alpha1"},
		// TODO generate CRD from thema (for ThemaSchema components)
		CRDDirectoryPaths: []string{"./crd.yml"},
		ObjectSchemaFactory: newDatasourceThemaSchema,
		StoreFactory: func(ss *sqlstore.SQLStore) store.Store {
			return ProvideDataSourceSchemaStore(ss)
		},
		ReconcilerFactory: func(cfg *setting.Cfg, bridge *k8sbridge.Service, s store.Store) error {
			_, err := ProvideDatasourceReconciler(cfg, bridge, s)
			return err
		},
		ObjectFactory: func() (runtime.Object, string) {
			datasourceName := "test-datasource"
			return &Datasource {
				ObjectMeta: metav1.ObjectMeta{
					Name: datasourceName,
				},
				Spec: Model{
					Type: "prom",
					Access: "proxy",
					Url: "http://localhost:9090",
					BasicAuth: true,
					BasicAuthUser: "admin",
					//SecureJsonFields: map[string]bool{"basicAuthPassword": true},
				},	
			}, datasourceName
		},
		Resource: "datasources",
		Namespace: "default",
	}
	testinfra.RunComponentTests(t, testCompCfg)
}
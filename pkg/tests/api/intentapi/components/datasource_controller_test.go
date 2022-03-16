package components

import (
	"testing"

	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/components/datasource"
	grafanaSchema "github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
)

func TestDatasourceController(t *testing.T) {
	cfg := componentTestCfg{
		objectSchemaFactory: func(t *testing.T, st components.Store, schml *grafanaSchema.SchemaLoader) grafanaSchema.ObjectSchema {
			dcm, err := datasource.ProvideCoremodel(st, schml)
			require.NoError(t, err)
			return dcm.Schema()
		},
		storeFactory: func(ss *sqlstore.SQLStore) components.Store {
			return sqlstore.ProvideDataSourceSchemaStore(ss)
		},
		testCaseFactory: func() testCaseCfg {
			name := "test-datasource"
			d := &datasource.Datasource{
				ObjectMeta: metav1.ObjectMeta{
					Name: name,
				},
				TypeMeta: metav1.TypeMeta{
					Kind:       "Datasource",
					APIVersion: "datasource.core.grafana/v1alpha1",
				},
				Spec: datasource.DatasourceSpec{
					Type:              "prometheus",
					Access:            "proxy",
					Url:               "http://localhost:1111/api/prom",
					User:              "test",
					Password:          "test",
					BasicAuth:         true,
					BasicAuthUser:     "admin",
					BasicAuthPassword: "test",
					WithCredentials:   false,
					IsDefault:         false,
					JsonData:          "",
					Version:           1,
					ReadOnly:          true,
				},
			}
			return testCaseCfg{
				objectName: name,
				postBody: func() runtime.Object {
					return d
				},
				postAssertFunc: func(t *testing.T, o runtime.Object) bool {
					res, ok := o.(*datasource.Datasource)
					require.True(t, ok)

					return res.Spec.Url == "http://localhost:1111/api/prom"
				},
				putBody: func(t *testing.T, res rest.Result) runtime.Object {
					existing := datasource.Datasource{}
					err := res.Into(&existing)
					require.NoError(t, err)

					updated := d.DeepCopyObject().(*datasource.Datasource)
					updated.ResourceVersion = existing.ResourceVersion
					updated.Spec.Url = "http://localhost:1111/api/prom1"
					return updated
				},
				putAssertFunc: func(t *testing.T, o runtime.Object) bool {
					res, ok := o.(*datasource.Datasource)
					require.True(t, ok)

					return res.Spec.Url == "http://localhost:1111/api/prom1"
				},
			}
		},
	}
	runTestCase(t, cfg)
}

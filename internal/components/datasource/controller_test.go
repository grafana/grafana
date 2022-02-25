package datasource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"sigs.k8s.io/controller-runtime/pkg/manager"
)

type fakeStoreDS struct {
}

func (s fakeStoreDS) Get(ctx context.Context, uid string) (Datasource, error) {
	return Datasource{}, nil
}

func (s fakeStoreDS) Insert(ctx context.Context, ds Datasource) error {
	return nil
}

func (s fakeStoreDS) Update(ctx context.Context, ds Datasource) error {
	return nil
}

func (s fakeStoreDS) Delete(ctx context.Context, uid string) error {
	return nil
}

func TestDatasource(t *testing.T) {
	mgr := setup(t, compCfg{
		GroupVersion: schema.GroupVersion{Group: "grafana.core.group", Version: "v1alpha1"},
		CRDDirectoryPaths: []string{"./crd.yml"},
		Objects: []runtime.Object{&Datasource{}, &CRList{}},
		ControllerProvider: func(mgr manager.Manager, cli rest.Interface) error {
			_, err := ProvideDatasourceController(mgr, cli, fakeStoreDS{})
			return err
		},
	})
	defer tearDown(t, mgr)

	testCases := []struct {
		desc string
		testScenario func(c rest.RESTClient) error
	}{
		{
			desc: "Test datasource creation",
			testScenario: func (c rest.RESTClient) error {
				datasourceName := "test-datasource"
				d := Datasource {
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
				}

				req := c.Post().
				Resource("datasources").
				// TODO create namespace for tests
				Namespace("default")
				req.Body(&d)
				res := req.Do(context.TODO())
				require.NoError(t, res.Error())

				t.Cleanup(func () {
					res := c.Delete().
					Resource("datasources").
					Namespace("default").
					Name(datasourceName).
					Do(context.TODO())
					require.NoError(t, res.Error())
				})
				
				return nil
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func (t *testing.T) {
			err := tc.testScenario(mgr.Client)
			require.NoError(t, err)
		})
	}
}
package datasource

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/internal/components/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"sigs.k8s.io/controller-runtime/pkg/manager"
)

func TestDatasource(t *testing.T) {
	store := testinfra.FakeStore{}
	testCompCfg := testinfra.TestCompCfg{
		GroupVersion: schema.GroupVersion{Group: "grafana.core.group", Version: "v1alpha1"},
		// TODO generate CRD from thema (for ThemaSchema components)
		CRDDirectoryPaths: []string{"./crd.yml"},
		Objects: []runtime.Object{&Datasource{}, &CRList{}},
		ControllerProvider: func(mgr manager.Manager, cli rest.Interface) error {
			_, err := ProvideDatasourceController(mgr, cli, store)
			return err
		},
	}
	mgr := testinfra.SetupTest(t, testCompCfg)

	origReconciliationPeriod := requeueAfter
	requeueAfter = time.Second
	defer func () {
		testinfra.TearDownTest(t, mgr)
		requeueAfter = origReconciliationPeriod
	}()

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
				/*
				var resultDatasource Datasource
				err := res.Into(&resultDatasource)
				require.NoError(t, err)
				*/

				defer func () {
					res := c.Delete().
					Resource("datasources").
					Namespace("default").
					Name(datasourceName).
					Do(context.TODO())
					require.NoError(t, res.Error())

					assert.Eventually(t, func() bool {
						res = c.Get().
						Resource("datasources").
						Namespace("default").
						Name(datasourceName).
						Do(context.TODO())
						return res.Error() != nil
					}, 10 * time.Second, 10 * time.Millisecond)
				}()

				assert.Eventually(t, func() bool {
					res = c.Get().
					Resource("datasources").
					Namespace("default").
					Name(datasourceName).
					Do(context.TODO())
					return res.Error() == nil

					/*
					_, err := store.Get(context.TODO(), string(resultDatasource.UID))
					return err == nil
					*/
				}, 10 * time.Second, 250 * time.Millisecond)
				
				return nil
			},
		},
		{
			desc: "Creation of datasource with reserved name should fail",
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

				defer func () {
					res := c.Delete().
					Resource("datasources").
					Namespace("default").
					Name(datasourceName).
					Do(context.TODO())
					require.NoError(t, res.Error())

					assert.Eventually(t, func() bool {
						res = c.Get().
						Resource("datasources").
						Namespace("default").
						Name(datasourceName).
						Do(context.TODO())
						return res.Error() != nil
					}, 10 * time.Second, 10 * time.Millisecond)
				}()

				assert.Eventually(t, func() bool {
					res = c.Get().
					Resource("datasources").
					Namespace("default").
					Name(datasourceName).
					Do(context.TODO())
					return res.Error() == nil
				}, 10 * time.Second, 250 * time.Millisecond)

				req = c.Post().
				Resource("datasources").
				// TODO create namespace for tests
				Namespace("default")
				req.Body(&d)
				res = req.Do(context.TODO())
				require.Error(t, res.Error())
				
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
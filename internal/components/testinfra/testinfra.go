package testinfra

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/internal/components/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

type TestCompCfg struct {
	GroupVersion schema.GroupVersion
	CRDDirectoryPaths []string
	Objects []runtime.Object
	StoreFactory func(*sqlstore.SQLStore) store.Store
	ControllerFactory func (manager.Manager, rest.Interface, store.Store) error
	ObjectFactory func() (runtime.Object, string)
	Resource string
	Namespace string
}


type TestManager struct {
	manager.Manager
	Client rest.RESTClient
	env *envtest.Environment
	componentStore store.Store
}

func RunComponentTests(t *testing.T, testCompCfg TestCompCfg) {
	mgr := setup(t, testCompCfg)

	/*
	origReconciliationPeriod := requeueAfter
	requeueAfter = time.Second
	*/
	defer func () {
		tearDown(t, mgr)
		//requeueAfter = origReconciliationPeriod
	}()

	ro, objectName := testCompCfg.ObjectFactory()

	testCases := []struct {
		desc string
		testScenario func(c rest.RESTClient) error
	}{
		{
			desc: "Test datasource creation",
			testScenario: func (c rest.RESTClient) error {
				// create object
				req := c.Post().
				Resource(testCompCfg.Resource).
				// TODO create namespace for tests
				Namespace(testCompCfg.Namespace)
				req.Body(ro)
				res := req.Do(context.Background())
				require.NoError(t, res.Error())

				defer func () {
					// delete object
					res := c.Delete().
					Resource(testCompCfg.Resource).
					Namespace(testCompCfg.Namespace).
					Name(objectName).
					Do(context.Background())
					require.NoError(t, res.Error())

					// make sure that the object is deleted
					assert.Eventually(t, func() bool {
						res = c.Get().
						Resource(testCompCfg.Resource).
						Namespace(testCompCfg.Namespace).
						Name(objectName).
						Do(context.Background())
						return res.Error() != nil
					}, 10 * time.Second, 10 * time.Millisecond)
				}()

				assert.Eventually(t, func() bool {
					/*
					res = c.Get().
					Resource(testCompCfg.Resource).
					Namespace(testCompCfg.Namespace).
					Name(objectName).
					Do(context.Background())
					return res.Error() == nil
					*/

					// make sure that the object exists in store
					_, err := mgr.componentStore.Get(context.Background(), objectName)
					return err == nil
				}, 10 * time.Second, 250 * time.Millisecond)
				
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


func setup(t *testing.T, componentCfg TestCompCfg) TestManager {
	t.Helper()

	schemaBuilder := &scheme.Builder{GroupVersion: componentCfg.GroupVersion}

	schemaBuilder.Register(componentCfg.Objects...)
	schm, err := schemaBuilder.Build()
	require.NoError(t, err)

	testEnv := envtest.Environment {
		CRDDirectoryPaths: componentCfg.CRDDirectoryPaths,
		CRDInstallOptions: envtest.CRDInstallOptions{
			CleanUpAfterUse: true,
		},
		Config: getConfig(schm, componentCfg.GroupVersion),
		UseExistingCluster: pointer.Bool(true),
		Scheme: schm,
	}

	cfg, err := testEnv.Start()
	require.NoError(t, err)

	mgr, err := manager.New(cfg, manager.Options{
		Scheme: schm,
		//SyncPeriod: pointer.Duration(time.Second),
	})
	require.NoError(t, err)

	c, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)

	ossMigrations := migrations.ProvideOSSMigrations()
	sqlStore, err := sqlstore.ProvideServiceForTests(ossMigrations)
	require.NoError(t, err)

	compStore := componentCfg.StoreFactory(sqlStore)
	err = componentCfg.ControllerFactory(mgr, c, compStore)
	require.NoError(t, err)

	go func() {
		err = mgr.Start(ctrl.SetupSignalHandler())
		require.NoError(t, err)
	}()

	return TestManager{
		mgr,
		*c,
		&testEnv,
		compStore,
	}
}

func tearDown(t *testing.T, mgr TestManager) {
	t.Helper()

	err := mgr.env.Stop()
	require.NoError(t, err)
}

func getConfig(schm *runtime.Scheme, gv schema.GroupVersion) *rest.Config {
	return &rest.Config{
		Host: "localhost:6443",
		Username: "admin",
		APIPath: "/apis",
		TLSClientConfig: rest.TLSClientConfig{
			ServerName: "localhost",
			CertFile: "/Users/josefk/go/src/github.com/grafana/grafana/devenv/docker/blocks/intentapi/certs/admin.pem",
			KeyFile: "/Users/josefk/go/src/github.com/grafana/grafana/devenv/docker/blocks/intentapi/certs/admin-key.pem",
			CAFile: "/Users/josefk/go/src/github.com/grafana/grafana/devenv/docker/blocks/intentapi/certs/ca.pem",
		},
		ContentConfig: rest.ContentConfig{
			GroupVersion: &gv,
			NegotiatedSerializer: serializer.NewCodecFactory(schm),
		},
	}
}

package testinfra

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/internal/components/store"
	"github.com/grafana/grafana/internal/k8sbridge"
	grafanaSchema "github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
	"gopkg.in/ini.v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	"sigs.k8s.io/controller-runtime/pkg/manager"
)

type TestCompCfg struct {
	GroupVersion schema.GroupVersion
	CRDDirectoryPaths []string
	ObjectSchemaFactory func() grafanaSchema.ObjectSchema
	StoreFactory func(*sqlstore.SQLStore) store.Store
	ReconcilerFactory func (*setting.Cfg, *k8sbridge.Service, store.Store) error
	ObjectFactory func() (runtime.Object, string)
	Resource string
	Namespace string
}


type TestManager struct {
	manager.Manager
	Client *k8sbridge.Clientset
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
		testScenario func(c *k8sbridge.Clientset) error
	}{
		{
			desc: "Test resource creation",
			testScenario: func (c *k8sbridge.Clientset) error {
				// create object
				req := c.GrafanaCoreV1().Post().
				Resource(testCompCfg.Resource).
				// TODO create namespace for tests
				Namespace(testCompCfg.Namespace)
				req.Body(ro)
				res := req.Do(context.Background())
				require.NoError(t, res.Error())

				defer func () {
					// delete object
					res := c.GrafanaCoreV1().Delete().
					Resource(testCompCfg.Resource).
					Namespace(testCompCfg.Namespace).
					Name(objectName).
					Do(context.Background())
					require.NoError(t, res.Error())

					// make sure that the object is deleted
					assert.Eventually(t, func() bool {
						res = c.GrafanaCoreV1().Get().
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

	grafanaCfg := setting.Cfg{
		Raw: ini.Empty(),
	}
	grafanaCfg.Raw.Section("intentapi.kubebridge").
	Key("kubeconfig_path").
	SetValue("/Users/josefk/go/src/github.com/grafana/grafana/devenv/docker/blocks/intentapi/apiserver.kubeconfig")

	brdg, err := k8sbridge.ProvideService(&grafanaCfg, &fakeFeatureManager{}, []grafanaSchema.ObjectSchema{componentCfg.ObjectSchemaFactory()})
	require.NoError(t, err)

	testEnv := envtest.Environment {
		CRDDirectoryPaths: componentCfg.CRDDirectoryPaths,
		CRDInstallOptions: envtest.CRDInstallOptions{
			CleanUpAfterUse: true,
		},
		Config: brdg.RestConfig(),
		UseExistingCluster: pointer.Bool(true),
		Scheme: brdg.ControllerManager().GetScheme(),
	}

	_, err = testEnv.Start()
	require.NoError(t, err)

	ossMigrations := migrations.ProvideOSSMigrations()
	sqlStore, err := sqlstore.ProvideServiceForTests(ossMigrations)
	require.NoError(t, err)

	compStore := componentCfg.StoreFactory(sqlStore)
	err = componentCfg.ReconcilerFactory(&grafanaCfg, brdg, compStore)
	require.NoError(t, err)

	go func() {
		err = brdg.Run(context.Background())
		require.NoError(t, err)
	}()

	return TestManager{
		brdg.ControllerManager(),
		brdg.Client(),
		&testEnv,
		compStore,
	}
}

func tearDown(t *testing.T, mgr TestManager) {
	t.Helper()

	err := mgr.env.Stop()
	require.NoError(t, err)
}

type fakeFeatureManager struct {}

func (fm *fakeFeatureManager) IsEnabled(flag string) bool {
	return flag == featuremgmt.FlagIntentapi
}

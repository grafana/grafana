package testinfra

import (
	"testing"

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

type TestCompCfg struct {
	GroupVersion schema.GroupVersion
	CRDDirectoryPaths []string
	Objects []runtime.Object
	ControllerProvider func (manager.Manager, rest.Interface) error
}


type TestManager struct {
	manager.Manager
	Client rest.RESTClient
	env *envtest.Environment
}

func SetupTest(t *testing.T, componentCfg TestCompCfg) TestManager {
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

	err = componentCfg.ControllerProvider(mgr, c)
	require.NoError(t, err)

	go func() {
		err = mgr.Start(ctrl.SetupSignalHandler())
		require.NoError(t, err)
	}()

	return TestManager{
		mgr,
		*c,
		&testEnv,
	}
}

func TearDownTest(t *testing.T, mgr TestManager) {
	err := mgr.env.Stop()
	require.NoError(t, err)
}
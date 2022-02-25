package datasource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

func getConfig(schm *runtime.Scheme) *rest.Config {
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
			GroupVersion: &schema.GroupVersion{Group: "grafana.core.group", Version: "v1alpha1"},
			NegotiatedSerializer: serializer.NewCodecFactory(schm),
		},
	}
}

type compCfg struct {
	GroupVersion schema.GroupVersion
	CRDDirectoryPaths []string
	Objects []runtime.Object
	ControllerProvider func (manager.Manager, rest.Interface) error
}


type testManager struct {
	manager.Manager
	Client rest.RESTClient
	env *envtest.Environment
}

func setup(t *testing.T, componentCfg compCfg) testManager {
	schemaBuilder := &scheme.Builder{GroupVersion: componentCfg.GroupVersion}

	schemaBuilder.Register(componentCfg.Objects...)
	schm, err := schemaBuilder.Build()
	require.NoError(t, err)

	testEnv := envtest.Environment {
		CRDDirectoryPaths: componentCfg.CRDDirectoryPaths,
		CRDInstallOptions: envtest.CRDInstallOptions{
			CleanUpAfterUse: true,
		},
		Config: getConfig(schm),
		UseExistingCluster: pointer.Bool(true),
		Scheme: schm,
	}

	cfg, err := testEnv.Start()
	require.NoError(t, err)

	mgr, err := manager.New(cfg, manager.Options{
		Scheme: schm,
	})
	require.NoError(t, err)

	c, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)

	/*
	ossMigrations := migrations.ProvideOSSMigrations()
	sqlStore, err := sqlstore.ProvideServiceForTests(ossMigrations)
	require.NoError(t, err)

	dsStore := sqlstore.ProvideDataSourceSchemaStore(sqlStore)
	_, err = setupControllerWithManagerFunc(mgr, c, dsStore)
	*/
	err = componentCfg.ControllerProvider(mgr, c)
	require.NoError(t, err)

	go func() {
		err = mgr.Start(context.Background())
		require.NoError(t, err)
	}()

	return testManager{
		mgr,
		*c,
		&testEnv,
	}
}

func tearDown(t *testing.T, mgr testManager) {
	err := mgr.env.Stop()
	require.NoError(t, err)
}
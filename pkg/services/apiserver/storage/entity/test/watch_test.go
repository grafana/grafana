// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apiserver/pkg/storage/etcd3/watcher_test.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/apitesting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apiserver/pkg/apis/example"
	examplev1 "k8s.io/apiserver/pkg/apis/example/v1"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	storagetesting "k8s.io/apiserver/pkg/storage/testing"

	"github.com/grafana/grafana/pkg/services/apiserver/storage/entity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	entityStore "github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var scheme = runtime.NewScheme()
var codecs = serializer.NewCodecFactory(scheme)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func createTestContext(t *testing.T) (entityStore.EntityStoreClient, factory.DestroyFunc) {
	t.Helper()

	grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrpcServer,
			featuremgmt.FlagUnifiedStorage,
		},
		AppModeProduction: false,         // required for migrations to run
		GRPCServerAddress: "127.0.0.1:0", // :0 for choosing the port automatically
	})

	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{Config: cfgPath, HomePath: grafDir})
	assert.NoError(t, err)

	featureManager, err := featuremgmt.ProvideManagerService(cfg)
	assert.NoError(t, err)

	featureToggles := featuremgmt.ProvideToggles(featureManager)

	db := sqlstore.InitTestDBWithMigration(t, nil, sqlstore.InitTestDBOpt{EnsureDefaultOrgAndUser: false})
	require.NoError(t, err)

	eDB, err := dbimpl.ProvideEntityDB(db, cfg, featureToggles)
	require.NoError(t, err)

	err = eDB.Init()
	require.NoError(t, err)

	store, err := sqlstash.ProvideSQLEntityServer(eDB)
	require.NoError(t, err)

	client := entityStore.NewEntityStoreClientLocal(store)

	return client, func() { store.Stop() }
}

func init() {
	metav1.AddToGroupVersion(scheme, metav1.SchemeGroupVersion)
	utilruntime.Must(example.AddToScheme(scheme))
	utilruntime.Must(examplev1.AddToScheme(scheme))
}

type setupOptions struct {
	codec          runtime.Codec
	newFunc        func() runtime.Object
	newListFunc    func() runtime.Object
	prefix         string
	resourcePrefix string
	groupResource  schema.GroupResource
}

type setupOption func(*setupOptions, *testing.T)

func withDefaults(options *setupOptions, t *testing.T) {
	options.codec = apitesting.TestCodec(codecs, examplev1.SchemeGroupVersion)
	options.newFunc = newPod
	options.newListFunc = newPodList
	options.prefix = t.TempDir()
	options.resourcePrefix = "/pods"
	options.groupResource = schema.GroupResource{Resource: "pods"}
}

var _ setupOption = withDefaults

func testSetup(t *testing.T, opts ...setupOption) (context.Context, storage.Interface, factory.DestroyFunc, error) {
	setupOpts := setupOptions{}
	opts = append([]setupOption{withDefaults}, opts...)
	for _, opt := range opts {
		opt(&setupOpts, t)
	}

	config := storagebackend.NewDefaultConfig(setupOpts.prefix, setupOpts.codec)

	client, destroyFunc := createTestContext(t)

	store, _, err := entity.NewStorage(
		config.ForResource(setupOpts.groupResource),
		setupOpts.groupResource,
		client,
		setupOpts.codec,
		func(obj runtime.Object) (string, error) {
			return storage.NamespaceKeyFunc(setupOpts.resourcePrefix, obj)
		},
		setupOpts.newFunc,
		setupOpts.newListFunc,
		storage.DefaultNamespaceScopedAttr,
	)
	if err != nil {
		return nil, nil, nil, err
	}

	ctx := context.Background()

	wrappedStore := &RequestInfoWrapper{
		store: store,
		gr:    setupOpts.groupResource,
	}

	return ctx, wrappedStore, destroyFunc, nil
}

func TestIntegrationWatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatch(ctx, t, store)
}

func TestIntegrationClusterScopedWatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestClusterScopedWatch(ctx, t, store)
}

func TestIntegrationNamespaceScopedWatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestNamespaceScopedWatch(ctx, t, store)
}

func TestIntegrationDeleteTriggerWatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestDeleteTriggerWatch(ctx, t, store)
}

func TestIntegrationWatchFromZero(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatchFromZero(ctx, t, store, nil)
}

// TestWatchFromNonZero tests that
// - watch from non-0 should just watch changes after given version
func TestIntegrationWatchFromNonZero(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatchFromNonZero(ctx, t, store)
}

/*
// TODO this times out, we need to buffer events
func TestIntegrationDelayedWatchDelivery(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestDelayedWatchDelivery(ctx, t, store)
}
*/

/* func TestIntegrationWatchError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, _ := testSetup(t)
	storagetesting.RunTestWatchError(ctx, t, &storeWithPrefixTransformer{store})
} */

func TestIntegrationWatchContextCancel(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatchContextCancel(ctx, t, store)
}

func TestIntegrationWatcherTimeout(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatcherTimeout(ctx, t, store)
}

func TestIntegrationWatchDeleteEventObjectHaveLatestRV(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatchDeleteEventObjectHaveLatestRV(ctx, t, store)
}

// TODO: enable when we support flow control and priority fairness
/* func TestIntegrationWatchInitializationSignal(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatchInitializationSignal(ctx, t, store)
} */

/* func TestIntegrationProgressNotify(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunOptionalTestProgressNotify(ctx, t, store)
} */

// TestWatchDispatchBookmarkEvents makes sure that
// setting allowWatchBookmarks query param against
// etcd implementation doesn't have any effect.
func TestIntegrationWatchDispatchBookmarkEvents(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunTestWatchDispatchBookmarkEvents(ctx, t, store, false)
}

func TestIntegrationSendInitialEventsBackwardCompatibility(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunSendInitialEventsBackwardCompatibility(ctx, t, store)
}

// TODO this test times out
func TestIntegrationEtcdWatchSemantics(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunWatchSemantics(ctx, t, store)
}

/*
// TODO this test times out
func TestIntegrationEtcdWatchSemanticInitialEventsExtended(t *testing.T) {
		if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx, store, destroyFunc, err := testSetup(t)
	defer destroyFunc()
	assert.NoError(t, err)
	storagetesting.RunWatchSemanticInitialEventsExtended(ctx, t, store)
}
*/

func newPod() runtime.Object {
	return &example.Pod{}
}

func newPodList() runtime.Object {
	return &example.PodList{}
}

package kvstore

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func NewFakeSQLSecretsKVStore(t *testing.T) *SecretsKVStoreSQL {
	t.Helper()
	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	return NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
}

func NewFakePluginSecretsKVStore(t *testing.T, features featuremgmt.FeatureToggles, fallback SecretsKVStore) *SecretsKVStorePlugin {
	t.Helper()
	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	store := kvstore.ProvideService(sqlStore)
	namespacedKVStore := GetNamespacedKVStore(store)
	manager := NewFakeSecretsPluginManager(t, false)
	plugin := manager.SecretsManager(context.Background()).SecretsManager
	return NewPluginSecretsKVStore(plugin, secretsService, namespacedKVStore, features, fallback, log.New("test.logger"))
}

// In memory kv store used for testing
type FakeSecretsKVStore struct {
	store    map[Key]string
	delError bool
	fallback SecretsKVStore
}

func NewFakeSecretsKVStore() *FakeSecretsKVStore {
	return &FakeSecretsKVStore{store: make(map[Key]string)}
}

func (f *FakeSecretsKVStore) DeletionError(shouldErr bool) {
	f.delError = shouldErr
}

func (f *FakeSecretsKVStore) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	value := f.store[buildKey(orgId, namespace, typ)]
	found := value != ""
	return value, found, nil
}

func (f *FakeSecretsKVStore) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	f.store[buildKey(orgId, namespace, typ)] = value
	return nil
}

func (f *FakeSecretsKVStore) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	if f.delError {
		return errors.New("mocked del error")
	}
	delete(f.store, buildKey(orgId, namespace, typ))
	return nil
}

// List all keys with an optional filter. If default values are provided, filter is not applied.
func (f *FakeSecretsKVStore) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	res := make([]Key, 0)
	for k := range f.store {
		if orgId == AllOrganizations && namespace == "" && typ == "" {
			res = append(res, k)
		} else if k.OrgId == orgId && k.Namespace == namespace && k.Type == typ {
			res = append(res, k)
		}
	}
	return res, nil
}

func (f *FakeSecretsKVStore) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	f.store[buildKey(orgId, newNamespace, typ)] = f.store[buildKey(orgId, namespace, typ)]
	delete(f.store, buildKey(orgId, namespace, typ))
	return nil
}

func (f *FakeSecretsKVStore) GetAll(ctx context.Context) ([]Item, error) {
	items := make([]Item, 0)
	for k := range f.store {
		orgId := k.OrgId
		namespace := k.Namespace
		typ := k.Type
		items = append(items, Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
			Value:     f.store[k],
		})
	}
	return items, nil
}

func (f *FakeSecretsKVStore) Fallback() SecretsKVStore {
	return f.fallback
}

func (f *FakeSecretsKVStore) SetFallback(store SecretsKVStore) error {
	f.fallback = store
	return nil
}

func buildKey(orgId int64, namespace string, typ string) Key {
	return Key{
		OrgId:     orgId,
		Namespace: namespace,
		Type:      typ,
	}
}

func internalToProtoKey(k Key) *secretsmanagerplugin.Key {
	return &secretsmanagerplugin.Key{
		OrgId:     k.OrgId,
		Namespace: k.Namespace,
		Type:      k.Type,
	}
}

// Fake feature toggle - only need to check the backwards compatibility disabled flag
type fakeFeatureToggles struct {
	returnValue bool
}

func NewFakeFeatureToggles(t *testing.T, returnValue bool) featuremgmt.FeatureToggles {
	t.Helper()
	return fakeFeatureToggles{
		returnValue: returnValue,
	}
}

func (f fakeFeatureToggles) IsEnabled(feature string) bool {
	return f.returnValue
}

// Fake grpc secrets plugin impl
type fakeGRPCSecretsPlugin struct {
	kv map[Key]string
}

func (c *fakeGRPCSecretsPlugin) GetSecret(ctx context.Context, in *secretsmanagerplugin.GetSecretRequest, opts ...grpc.CallOption) (*secretsmanagerplugin.GetSecretResponse, error) {
	val, ok := c.kv[buildKey(in.KeyDescriptor.OrgId, in.KeyDescriptor.Namespace, in.KeyDescriptor.Type)]
	return &secretsmanagerplugin.GetSecretResponse{
		DecryptedValue: val,
		Exists:         ok,
	}, nil
}

func (c *fakeGRPCSecretsPlugin) SetSecret(ctx context.Context, in *secretsmanagerplugin.SetSecretRequest, opts ...grpc.CallOption) (*secretsmanagerplugin.SetSecretResponse, error) {
	c.kv[buildKey(in.KeyDescriptor.OrgId, in.KeyDescriptor.Namespace, in.KeyDescriptor.Type)] = in.Value
	return &secretsmanagerplugin.SetSecretResponse{}, nil
}

func (c *fakeGRPCSecretsPlugin) DeleteSecret(ctx context.Context, in *secretsmanagerplugin.DeleteSecretRequest, opts ...grpc.CallOption) (*secretsmanagerplugin.DeleteSecretResponse, error) {
	delete(c.kv, buildKey(in.KeyDescriptor.OrgId, in.KeyDescriptor.Namespace, in.KeyDescriptor.Type))
	return &secretsmanagerplugin.DeleteSecretResponse{}, nil
}

func (c *fakeGRPCSecretsPlugin) ListSecrets(ctx context.Context, in *secretsmanagerplugin.ListSecretsRequest, opts ...grpc.CallOption) (*secretsmanagerplugin.ListSecretsResponse, error) {
	res := make([]*secretsmanagerplugin.Key, 0)
	for k := range c.kv {
		if in.KeyDescriptor.OrgId == AllOrganizations && in.KeyDescriptor.Namespace == "" && in.KeyDescriptor.Type == "" {
			res = append(res, internalToProtoKey(k))
		} else if k.OrgId == in.KeyDescriptor.OrgId && k.Namespace == in.KeyDescriptor.Namespace && k.Type == in.KeyDescriptor.Type {
			res = append(res, internalToProtoKey(k))
		}
	}
	return &secretsmanagerplugin.ListSecretsResponse{
		Keys: res,
	}, nil
}

func (c *fakeGRPCSecretsPlugin) RenameSecret(ctx context.Context, in *secretsmanagerplugin.RenameSecretRequest, opts ...grpc.CallOption) (*secretsmanagerplugin.RenameSecretResponse, error) {
	oldKey := buildKey(in.KeyDescriptor.OrgId, in.KeyDescriptor.Namespace, in.KeyDescriptor.Type)
	val := c.kv[oldKey]
	delete(c.kv, oldKey)
	c.kv[buildKey(in.KeyDescriptor.OrgId, in.NewNamespace, in.KeyDescriptor.Type)] = val
	return &secretsmanagerplugin.RenameSecretResponse{}, nil
}

func (c *fakeGRPCSecretsPlugin) GetAllSecrets(ctx context.Context, in *secretsmanagerplugin.GetAllSecretsRequest, opts ...grpc.CallOption) (*secretsmanagerplugin.GetAllSecretsResponse, error) {
	items := make([]*secretsmanagerplugin.Item, 0)
	for k, v := range c.kv {
		items = append(items, &secretsmanagerplugin.Item{
			Key:   internalToProtoKey(k),
			Value: v,
		})
	}
	return &secretsmanagerplugin.GetAllSecretsResponse{
		Items: items,
	}, nil
}

var _ SecretsKVStore = &FakeSecretsKVStore{}
var _ secretsmanagerplugin.SecretsManagerPlugin = &fakeGRPCSecretsPlugin{}

// Fake plugin manager
type fakePluginManager struct {
	shouldFailOnStart bool
	plugin            *plugins.Plugin
}

func (mg *fakePluginManager) SecretsManager(_ context.Context) *plugins.Plugin {
	if mg.plugin != nil {
		return mg.plugin
	}
	p := &plugins.Plugin{
		SecretsManager: &fakeGRPCSecretsPlugin{
			kv: make(map[Key]string),
		},
	}
	p.RegisterClient(&fakePluginClient{
		shouldFailOnStart: mg.shouldFailOnStart,
	})
	mg.plugin = p
	return p
}

func NewFakeSecretsPluginManager(t *testing.T, shouldFailOnStart bool) plugins.SecretsPluginManager {
	t.Helper()
	return &fakePluginManager{
		shouldFailOnStart: shouldFailOnStart,
	}
}

// Fake plugin client
type fakePluginClient struct {
	shouldFailOnStart bool
	backendplugin.Plugin
}

func (pc *fakePluginClient) Start(_ context.Context) error {
	if pc.shouldFailOnStart {
		return errors.New("mocked failed to start")
	}
	return nil
}

func (pc *fakePluginClient) Stop(_ context.Context) error {
	return nil
}

func SetupFatalCrashTest(
	t *testing.T,
	shouldFailOnStart bool,
	isPluginErrorFatal bool,
	isBackwardsCompatDisabled bool,
) (fatalCrashTestFields, error) {
	t.Helper()
	fatalFlagOnce = sync.Once{}
	startupOnce = sync.Once{}
	cfg := SetupTestConfig(t)
	sqlStore := db.InitTestDB(t)
	secretService := fakes.FakeSecretsService{}
	kvstore := kvstore.ProvideService(sqlStore)
	if isPluginErrorFatal {
		_ = SetPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore), true)
	}
	features := NewFakeFeatureToggles(t, isBackwardsCompatDisabled)
	manager := NewFakeSecretsPluginManager(t, shouldFailOnStart)
	svc, err := ProvideService(sqlStore, secretService, manager, kvstore, features, cfg)
	t.Cleanup(ResetPlugin)
	return fatalCrashTestFields{
		SecretsKVStore: svc,
		PluginManager:  manager,
		KVStore:        kvstore,
		SqlStore:       sqlStore,
	}, err
}

type fatalCrashTestFields struct {
	SecretsKVStore SecretsKVStore
	PluginManager  plugins.SecretsPluginManager
	KVStore        kvstore.KVStore
	SqlStore       db.DB
}

func SetupTestConfig(t *testing.T) *setting.Cfg {
	t.Helper()
	rawCfg := `
		[secrets]
		use_plugin = true
		`
	raw, err := ini.Load([]byte(rawCfg))
	require.NoError(t, err)
	return &setting.Cfg{Raw: raw}
}

func ReplaceFallback(t *testing.T, kv SecretsKVStore, fb SecretsKVStore) error {
	t.Helper()
	if store, ok := kv.(*CachedKVStore); ok {
		kv = store.store
	}
	if store, ok := kv.(*SecretsKVStorePlugin); ok {
		store.fallbackStore = fb
		return nil
	}
	return errors.New("not a plugin store")
}

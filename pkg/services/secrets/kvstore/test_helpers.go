package kvstore

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"google.golang.org/grpc"
)

func SetupTestService(t *testing.T) SecretsKVStore {
	t.Helper()

	sqlStore := sqlstore.InitTestDB(t)
	store := database.ProvideSecretsStore(sqlstore.InitTestDB(t))
	secretsService := manager.SetupTestService(t, store)

	kv := &secretsKVStoreSQL{
		sqlStore:       sqlStore,
		log:            log.New("secrets.kvstore"),
		secretsService: secretsService,
		decryptionCache: decryptionCache{
			cache: make(map[int64]cachedDecrypted),
		},
	}

	return kv
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
		return errors.New("bogus")
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

func (mg *fakePluginManager) SecretsManager() *plugins.Plugin {
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
		return errors.New("failed to start")
	}
	return nil
}

func (pc *fakePluginClient) Stop(_ context.Context) error {
	return nil
}

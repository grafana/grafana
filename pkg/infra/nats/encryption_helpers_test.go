package nats

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	cipherservice "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	// testKEK encrypts the data keys of every test server, as the instances of
	// one Grafana deployment share their encryption provider.
	testKEK = "nats-test-secret-key"
	// testNamespace is what Grafana resolves for the main org on-prem.
	testNamespace = xkube.Namespace("default")
)

// testDataKeys holds the data keys of every test server, like the
// secret_data_key table of the database they share.
var testDataKeys = newFakeDataKeys()

// testCredentials returns the route credential store of a test server whose
// encrypted values live in store, with the data keys and key every test server
// shares, so any server on store decrypts the credential another stored.
func testCredentials(t *testing.T, store kv.KV) routeCredentialStore {
	t.Helper()
	return credentialsWith(newFakeEncryption(t, testDataKeys, testKEK), store)
}

// otherKeyCredentials shares the data keys of testCredentials but encrypts them
// under another key, like an instance configured with another secret_key.
func otherKeyCredentials(t *testing.T, store kv.KV) routeCredentialStore {
	t.Helper()
	return credentialsWith(newFakeEncryption(t, testDataKeys, "another-secret-key"), store)
}

func credentialsWith(enc contracts.EncryptionManager, store kv.KV) routeCredentialStore {
	return routeCredentialStore{encryption: enc, values: kvEncryptedValues{store: store}, namespace: testNamespace}
}

// kvEncryptedValues stands in for the Secrets Manager encrypted value table,
// which the nats package cannot import in its own tests. It keeps values in a
// KV, so the KV fakes that fail or delay reads apply to the credential too.
// The external tests cover the real table.
type kvEncryptedValues struct {
	contracts.EncryptedValueStorage
	store kv.KV
}

// kvEncryptedValueKey is where the route credential, the only value the
// package stores, lives in the KV.
const kvEncryptedValueKey = "encrypted-value.route-credential"

func (v kvEncryptedValues) key(namespace xkube.Namespace, name string, version int64) (string, error) {
	if name != routeCredentialName(discoveryClusterName) || version != routeCredentialVersion {
		return "", fmt.Errorf("unexpected encrypted value %s/%s/%d", namespace, name, version)
	}
	return kvEncryptedValueKey, nil
}

func (v kvEncryptedValues) Create(ctx context.Context, namespace xkube.Namespace, name string, version int64, payload contracts.EncryptedPayload) (*contracts.EncryptedValue, error) {
	key, err := v.key(namespace, name, version)
	if err != nil {
		return nil, err
	}
	value, err := json.Marshal(kvEncryptedValueRow{Namespace: namespace.String(), Payload: payload})
	if err != nil {
		return nil, err
	}
	if err := v.store.Batch(ctx, kv.NATSPeersSection, []kv.BatchOp{{Mode: kv.BatchOpCreate, Key: key, Value: value}}); err != nil {
		return nil, err
	}
	return &contracts.EncryptedValue{EncryptedPayload: payload, Namespace: namespace.String(), Name: name, Version: version}, nil
}

func (v kvEncryptedValues) Get(ctx context.Context, namespace xkube.Namespace, name string, version int64) (*contracts.EncryptedValue, error) {
	key, err := v.key(namespace, name, version)
	if err != nil {
		return nil, err
	}
	r, err := v.store.Get(ctx, kv.NATSPeersSection, key)
	if errors.Is(err, kv.ErrNotFound) {
		return nil, contracts.ErrEncryptedValueNotFound
	}
	if err != nil {
		return nil, err
	}
	defer func() { _ = r.Close() }()
	var stored kvEncryptedValueRow
	if err := json.NewDecoder(r).Decode(&stored); err != nil {
		return nil, err
	}
	// The table is keyed by namespace, so another namespace has no value.
	if stored.Namespace != namespace.String() {
		return nil, contracts.ErrEncryptedValueNotFound
	}
	return &contracts.EncryptedValue{EncryptedPayload: stored.Payload, Namespace: stored.Namespace, Name: name, Version: version}, nil
}

type kvEncryptedValueRow struct {
	Namespace string
	Payload   contracts.EncryptedPayload
}

// encryptedValueRow is the KV value kvEncryptedValues stores for payload.
func encryptedValueRow(t *testing.T, payload contracts.EncryptedPayload) []byte {
	t.Helper()
	row, err := json.Marshal(kvEncryptedValueRow{Namespace: testNamespace.String(), Payload: payload})
	require.NoError(t, err)
	return row
}

// putEncryptedValue stores payload as the route credential of store.
func putEncryptedValue(t *testing.T, store kv.KV, payload contracts.EncryptedPayload) {
	t.Helper()
	_, err := kvEncryptedValues{store: store}.Create(t.Context(), testNamespace, routeCredentialName(discoveryClusterName), routeCredentialVersion, payload)
	require.NoError(t, err)
}

// fakeEncryption mirrors Secrets Manager envelope encryption, which the nats
// package cannot import in its own tests: per-namespace data keys, stored
// encrypted under a key encryption key, and the Secrets Manager AES-GCM cipher
// for both layers. A wrong key or a missing data key fails Decrypt as in
// Secrets Manager.
type fakeEncryption struct {
	contracts.EncryptionManager
	cipher cipher.Cipher
	kek    string
	keys   *fakeDataKeys
}

func newFakeEncryption(t *testing.T, keys *fakeDataKeys, kek string) *fakeEncryption {
	t.Helper()
	c, err := cipherservice.ProvideAESGCMCipherService(noop.NewTracerProvider().Tracer("test"), &usagestats.UsageStatsMock{})
	require.NoError(t, err)
	return &fakeEncryption{cipher: c, kek: kek, keys: keys}
}

func (f *fakeEncryption) Encrypt(ctx context.Context, namespace xkube.Namespace, payload []byte, _ contracts.EncryptionOption) (contracts.EncryptedPayload, error) {
	id, err := f.keys.current(ctx, namespace, func() ([]byte, error) {
		raw := make([]byte, 32)
		_, _ = rand.Read(raw)
		return f.cipher.Encrypt(ctx, raw, f.kek)
	})
	if err != nil {
		return contracts.EncryptedPayload{}, err
	}
	dataKey, err := f.dataKey(ctx, namespace, id)
	if err != nil {
		return contracts.EncryptedPayload{}, err
	}
	encrypted, err := f.cipher.Encrypt(ctx, payload, string(dataKey))
	if err != nil {
		return contracts.EncryptedPayload{}, err
	}
	return contracts.EncryptedPayload{DataKeyID: id, EncryptedData: encrypted}, nil
}

func (f *fakeEncryption) Decrypt(ctx context.Context, namespace xkube.Namespace, payload contracts.EncryptedPayload, _ contracts.EncryptionOption) ([]byte, error) {
	dataKey, err := f.dataKey(ctx, namespace, payload.DataKeyID)
	if err != nil {
		return nil, err
	}
	return f.cipher.Decrypt(ctx, payload.EncryptedData, string(dataKey))
}

func (f *fakeEncryption) dataKey(ctx context.Context, namespace xkube.Namespace, id string) ([]byte, error) {
	encrypted, ok := f.keys.get(namespace, id)
	if !ok {
		return nil, contracts.ErrDataKeyNotFound
	}
	return f.cipher.Decrypt(ctx, encrypted, f.kek)
}

// fakeDataKeys keeps encrypted data keys by namespace and id.
type fakeDataKeys struct {
	mu     sync.Mutex
	keys   map[string][]byte
	active map[xkube.Namespace]string
}

func newFakeDataKeys() *fakeDataKeys {
	return &fakeDataKeys{keys: map[string][]byte{}, active: map[xkube.Namespace]string{}}
}

// current returns the active data key of namespace, creating it with create
// on first use.
func (k *fakeDataKeys) current(_ context.Context, namespace xkube.Namespace, create func() ([]byte, error)) (string, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if id, ok := k.active[namespace]; ok {
		return id, nil
	}
	encrypted, err := create()
	if err != nil {
		return "", err
	}
	id := "data-key-" + randomSuffix()
	k.keys[string(namespace)+"/"+id] = encrypted
	k.active[namespace] = id
	return id, nil
}

func (k *fakeDataKeys) get(namespace xkube.Namespace, id string) ([]byte, bool) {
	k.mu.Lock()
	defer k.mu.Unlock()
	encrypted, ok := k.keys[string(namespace)+"/"+id]
	return encrypted, ok
}

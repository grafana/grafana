package nats

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync/atomic"
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
	// testKey is the encryption key every test server shares, as the
	// instances of one Grafana deployment share their encryption provider.
	testKey = "nats-test-secret-key"
	// testNamespace is what Grafana resolves for the main org on-prem.
	testNamespace = xkube.Namespace("default")
)

// testCredentials returns the route credential store of a test server whose
// encrypted values live in store, with the key every test server shares, so
// any server on store decrypts the credential another stored.
func testCredentials(t *testing.T, store kv.KV) routeCredentialStore {
	t.Helper()
	return credentialsWith(newFakeEncryption(t, testKey), store)
}

// otherKeyCredentials encrypts with another key, like an instance configured
// with another secret_key.
func otherKeyCredentials(t *testing.T, store kv.KV) routeCredentialStore {
	t.Helper()
	return credentialsWith(newFakeEncryption(t, "another-secret-key"), store)
}

// lostDataKeyCredentials cannot decrypt any stored credential, as after
// restoring a database without its data keys.
func lostDataKeyCredentials(t *testing.T, store kv.KV) routeCredentialStore {
	t.Helper()
	enc := newFakeEncryption(t, testKey)
	enc.lostDataKeys = true
	return credentialsWith(enc, store)
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

// fakeEncryption stands in for Secrets Manager encryption, which the nats
// package cannot import in its own tests. It encrypts with key, so an instance
// with another key cannot decrypt, and fails on demand. The external tests
// cover real Secrets Manager data keys, other keys and provider rotation.
type fakeEncryption struct {
	contracts.EncryptionManager
	cipher cipher.Cipher
	key    string
	// lostDataKeys fails every Decrypt, as after restoring a database without
	// its data keys.
	lostDataKeys bool
	// encryptFails fails every Encrypt, as when the active data key cannot be
	// decrypted.
	encryptFails atomic.Bool
}

// testDataKeyID is the data key id of every payload fakeEncryption encrypts.
const testDataKeyID = "test-data-key"

func newFakeEncryption(t *testing.T, key string) *fakeEncryption {
	t.Helper()
	c, err := cipherservice.ProvideAESGCMCipherService(noop.NewTracerProvider().Tracer("test"), &usagestats.UsageStatsMock{})
	require.NoError(t, err)
	return &fakeEncryption{cipher: c, key: key}
}

func (f *fakeEncryption) Encrypt(ctx context.Context, _ xkube.Namespace, payload []byte, _ contracts.EncryptionOption) (contracts.EncryptedPayload, error) {
	if f.encryptFails.Load() {
		return contracts.EncryptedPayload{}, errors.New("the active data key cannot be decrypted")
	}
	encrypted, err := f.cipher.Encrypt(ctx, payload, f.key)
	if err != nil {
		return contracts.EncryptedPayload{}, err
	}
	return contracts.EncryptedPayload{DataKeyID: testDataKeyID, EncryptedData: encrypted}, nil
}

func (f *fakeEncryption) Decrypt(ctx context.Context, _ xkube.Namespace, payload contracts.EncryptedPayload, _ contracts.EncryptionOption) ([]byte, error) {
	if f.lostDataKeys || payload.DataKeyID != testDataKeyID {
		return nil, contracts.ErrDataKeyNotFound
	}
	return f.cipher.Decrypt(ctx, payload.EncryptedData, f.key)
}

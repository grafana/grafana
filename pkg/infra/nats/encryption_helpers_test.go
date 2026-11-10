package nats

import (
	"context"
	"crypto/rand"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	cipherservice "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
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

// testCipher returns the route cipher the test servers share, so any of them
// can decrypt a route credential another stored.
func testCipher(t *testing.T) routeCipher {
	t.Helper()
	return routeCipher{encryption: newFakeEncryption(t, testDataKeys, testKEK), namespace: testNamespace}
}

// otherKeyCipher shares the data keys of testCipher but encrypts them under
// another key, like an instance configured with another secret_key.
func otherKeyCipher(t *testing.T) routeCipher {
	t.Helper()
	return routeCipher{encryption: newFakeEncryption(t, testDataKeys, "another-secret-key"), namespace: testNamespace}
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

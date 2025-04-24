package sqlkeeper

import (
	"context"
	"encoding/base64"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/setting"
)

// Make this a `TestIntegration<name>` once we have the real storage implementation
func Test_SQLKeeperSetup(t *testing.T) {
	ctx := context.Background()
	namespace1 := "namespace1"
	namespace2 := "namespace2"
	plaintext1 := "very secret string in namespace 1"
	plaintext2 := "very secret string in namespace 2"
	nonExistentID := contracts.ExternalID("non existent")

	cfg := setting.NewCfg()

	sqlKeeper, err := setupTestService(t, cfg)
	require.NoError(t, err)
	require.NotNil(t, sqlKeeper)

	t.Run("storing an encrypted value returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		externalId2, err := sqlKeeper.Store(ctx, nil, namespace2, plaintext2)
		require.NoError(t, err)
		require.NotEmpty(t, externalId2)

		t.Run("expose the encrypted value from existing namespace", func(t *testing.T) {
			exposedVal1, err := sqlKeeper.Expose(ctx, nil, namespace1, externalId1)
			require.NoError(t, err)
			require.NotNil(t, exposedVal1)
			assert.Equal(t, plaintext1, exposedVal1.DangerouslyExposeAndConsumeValue())

			exposedVal2, err := sqlKeeper.Expose(ctx, nil, namespace2, externalId2)
			require.NoError(t, err)
			require.NotNil(t, exposedVal2)
			assert.Equal(t, plaintext2, exposedVal2.DangerouslyExposeAndConsumeValue())
		})

		t.Run("expose encrypted value from different namespace returns error", func(t *testing.T) {
			exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace2, externalId1)
			require.Error(t, err)
			assert.Empty(t, exposedVal)

			exposedVal, err = sqlKeeper.Expose(ctx, nil, namespace1, externalId2)
			require.Error(t, err)
			assert.Empty(t, exposedVal)
		})
	})

	t.Run("storing same value in same namespace returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		externalId2, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId2)

		assert.NotEqual(t, externalId1, externalId2)
	})

	t.Run("storing same value in different namespace returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		externalId2, err := sqlKeeper.Store(ctx, nil, namespace2, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId2)

		assert.NotEqual(t, externalId1, externalId2)
	})

	t.Run("exposing non existing values returns error", func(t *testing.T) {
		exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace1, nonExistentID)
		require.Error(t, err)
		assert.Empty(t, exposedVal)
	})

	t.Run("deleting an existing encrypted value does not return error", func(t *testing.T) {
		externalID, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalID)

		exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace1, externalID)
		require.NoError(t, err)
		assert.NotNil(t, exposedVal)
		assert.Equal(t, plaintext1, exposedVal.DangerouslyExposeAndConsumeValue())

		err = sqlKeeper.Delete(ctx, nil, namespace1, externalID)
		require.NoError(t, err)
	})

	t.Run("deleting an non existing encrypted value does not return error", func(t *testing.T) {
		err = sqlKeeper.Delete(ctx, nil, namespace1, nonExistentID)
		require.NoError(t, err)
	})

	t.Run("updating an existent encrypted value returns no error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		err = sqlKeeper.Update(ctx, nil, namespace1, externalId1, plaintext2)
		require.NoError(t, err)

		exposedVal, err := sqlKeeper.Expose(ctx, nil, namespace1, externalId1)
		require.NoError(t, err)
		assert.NotNil(t, exposedVal)
		assert.Equal(t, plaintext2, exposedVal.DangerouslyExposeAndConsumeValue())
	})

	t.Run("updating a non existent encrypted value returns error", func(t *testing.T) {
		externalId1, err := sqlKeeper.Store(ctx, nil, namespace1, plaintext1)
		require.NoError(t, err)
		require.NotEmpty(t, externalId1)

		err = sqlKeeper.Update(ctx, nil, namespace1, nonExistentID, plaintext2)
		require.Error(t, err)
	})
}

func setupTestService(t *testing.T, cfg *setting.Cfg) (*SQLKeeper, error) {
	// Initialize the encryption manager with in-memory implementation
	encMgr := &inMemoryEncryptionManager{}

	// Initialize encrypted value storage with in-memory implementation
	encValueStore := newInMemoryEncryptedValueStorage()

	// Initialize the SQLKeeper
	sqlKeeper, err := NewSQLKeeper(tracing.InitializeTracerForTest(), encMgr, encValueStore)

	return sqlKeeper, err
}

// While we don't have the real implementation, use an in-memory one
type inMemoryEncryptionManager struct{}

func (m *inMemoryEncryptionManager) Encrypt(_ context.Context, _ string, value []byte, _ contracts.EncryptionOptions) ([]byte, error) {
	return []byte(base64.StdEncoding.EncodeToString(value)), nil
}

func (m *inMemoryEncryptionManager) Decrypt(_ context.Context, _ string, value []byte) ([]byte, error) {
	return base64.StdEncoding.DecodeString(string(value))
}

func (m *inMemoryEncryptionManager) ReEncryptDataKeys(_ context.Context, _ string) error {
	return nil
}

func (m *inMemoryEncryptionManager) RotateDataKeys(_ context.Context, _ string) error {
	return nil
}

// While we don't have the real implementation, use an in-memory one
type inMemoryEncryptedValueStorage struct {
	mu    sync.RWMutex
	store map[string]*contracts.EncryptedValue
}

func newInMemoryEncryptedValueStorage() *inMemoryEncryptedValueStorage {
	return &inMemoryEncryptedValueStorage{
		store: make(map[string]*contracts.EncryptedValue),
	}
}

func (m *inMemoryEncryptedValueStorage) Create(_ context.Context, namespace string, encryptedData []byte) (*contracts.EncryptedValue, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	uid := fmt.Sprintf("%d", len(m.store)+1) // Generate simple incremental IDs
	encValue := &contracts.EncryptedValue{
		UID:           uid,
		Namespace:     namespace,
		EncryptedData: encryptedData,
		Created:       1, // Dummy timestamp
		Updated:       1, // Dummy timestamp
	}

	compositeKey := namespace + ":" + uid
	m.store[compositeKey] = encValue

	return encValue, nil
}

func (m *inMemoryEncryptedValueStorage) Get(_ context.Context, namespace string, uid string) (*contracts.EncryptedValue, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	compositeKey := namespace + ":" + uid
	encValue, exists := m.store[compositeKey]
	if !exists {
		return nil, fmt.Errorf("value not found for namespace %s and uid %s", namespace, uid)
	}

	return encValue, nil
}

func (m *inMemoryEncryptedValueStorage) Delete(_ context.Context, namespace string, uid string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	compositeKey := namespace + ":" + uid
	delete(m.store, compositeKey)

	return nil
}

func (m *inMemoryEncryptedValueStorage) Update(_ context.Context, namespace string, uid string, encryptedData []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	compositeKey := namespace + ":" + uid
	encValue, exists := m.store[compositeKey]
	if !exists {
		return fmt.Errorf("value not found for namespace %s and uid %s", namespace, uid)
	}

	encValue.EncryptedData = encryptedData
	encValue.Updated = 2 // Update timestamp
	return nil
}

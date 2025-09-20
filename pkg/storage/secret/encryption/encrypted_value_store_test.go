package encryption_test

import (
	"bytes"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/stretchr/testify/require"
	"pgregory.net/rapid"
)

func TestEncryptedValueStoreImpl(t *testing.T) {
	t.Parallel()

	t.Run("creating an encrypted value returns it", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)
		require.NotEmpty(t, createdEV.Namespace)
		require.NotEmpty(t, createdEV.Name)
		require.NotEmpty(t, createdEV.Created)
		require.NotEmpty(t, createdEV.Updated)
		require.NotEmpty(t, createdEV.EncryptedData)
		require.Equal(t, "test-namespace", createdEV.Namespace)
		require.Equal(t, "test-name", createdEV.Name)
	})

	t.Run("get an existent encrypted value returns it", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		obtainedEV, err := sut.EncryptedValueStorage.Get(t.Context(), createdEV.Namespace, createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		require.Equal(t, createdEV.Namespace, obtainedEV.Namespace)
		require.Equal(t, createdEV.Name, obtainedEV.Name)
		require.Equal(t, createdEV.Created, obtainedEV.Created)
		require.Equal(t, createdEV.Updated, obtainedEV.Updated)
		require.Equal(t, createdEV.EncryptedData, obtainedEV.EncryptedData)
		require.Equal(t, createdEV.Namespace, obtainedEV.Namespace)
	})

	t.Run("get an existent encrypted value with a different namespace returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "ns1", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		obtainedEV, err := sut.EncryptedValueStorage.Get(t.Context(), "ns2", createdEV.Name, createdEV.Version)

		require.Error(t, err)
		require.Equal(t, "encrypted value not found", err.Error())
		require.Nil(t, obtainedEV)
	})

	t.Run("get a non existent encrypted value returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		obtainedEV, err := sut.EncryptedValueStorage.Get(t.Context(), "test-namespace", "test-name", 1)
		require.Error(t, err)
		require.Equal(t, "encrypted value not found", err.Error())
		require.Nil(t, obtainedEV)
	})

	t.Run("updating an existing encrypted value returns no error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		err = sut.EncryptedValueStorage.Update(t.Context(), createdEV.Namespace, createdEV.Name, createdEV.Version, []byte("test-data-updated"))
		require.NoError(t, err)

		updatedEV, err := sut.EncryptedValueStorage.Get(t.Context(), createdEV.Namespace, createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		require.Equal(t, []byte("test-data-updated"), updatedEV.EncryptedData)
		require.Equal(t, createdEV.Created, updatedEV.Created)
		require.Equal(t, createdEV.Namespace, updatedEV.Namespace)
	})

	t.Run("updating a non existing encrypted value returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		err := sut.EncryptedValueStorage.Update(t.Context(), "test-namespace", "test-uid", 1, []byte("test-data"))
		require.Error(t, err)
	})

	t.Run("delete an existing encrypted value returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, []byte("ttttest-data"))
		require.NoError(t, err)

		_, err = sut.EncryptedValueStorage.Get(t.Context(), createdEV.Namespace, createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		err = sut.EncryptedValueStorage.Delete(t.Context(), createdEV.Namespace, createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		obtainedEV, err := sut.EncryptedValueStorage.Get(t.Context(), createdEV.Namespace, createdEV.Name, createdEV.Version)
		require.Error(t, err)
		require.Nil(t, obtainedEV)
	})

	t.Run("delete a non existing encrypted value does not return error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		err := sut.EncryptedValueStorage.Delete(t.Context(), "test-namespace", "test-name", 1)
		require.NoError(t, err)
	})

	t.Run("listing encrypted values returns them", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEvA, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-a", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		createdEvB, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-b", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		// List all encrypted values, without pagination
		obtainedEVs, err := sut.GlobalEncryptedValueStorage.ListAll(t.Context(), contracts.ListOpts{}, nil)
		require.NoError(t, err)
		require.NotEmpty(t, obtainedEVs)
		require.Len(t, obtainedEVs, 2)

		obtainedEvA := obtainedEVs[0]
		require.Equal(t, createdEvA.Namespace, obtainedEvA.Namespace)
		require.Equal(t, createdEvA.Name, obtainedEvA.Name)
		require.Equal(t, createdEvA.EncryptedData, obtainedEvA.EncryptedData)

		// Test pagination by limiting the results to 1, offset by 0
		obtainedEVs, err = sut.GlobalEncryptedValueStorage.ListAll(t.Context(), contracts.ListOpts{Limit: 1}, nil)
		require.NoError(t, err)
		require.NotEmpty(t, obtainedEVs)
		require.Len(t, obtainedEVs, 1)

		obtainedEvA = obtainedEVs[0]
		require.Equal(t, createdEvA.Namespace, obtainedEvA.Namespace)
		require.Equal(t, createdEvA.Name, obtainedEvA.Name)
		require.Equal(t, createdEvA.EncryptedData, obtainedEvA.EncryptedData)

		// Test pagination by limiting the results to 1, offset by 1
		obtainedEVs, err = sut.GlobalEncryptedValueStorage.ListAll(t.Context(), contracts.ListOpts{Limit: 1, Offset: 1}, nil)
		require.NoError(t, err)
		require.NotEmpty(t, obtainedEVs)
		require.Len(t, obtainedEVs, 1)

		obtainedEvB := obtainedEVs[0]
		require.Equal(t, createdEvB.Namespace, obtainedEvB.Namespace)
		require.Equal(t, createdEvB.Name, obtainedEvB.Name)
		require.Equal(t, createdEvB.EncryptedData, obtainedEvB.EncryptedData)

		// List all encrypted values, until a certain time
		pastTime := time.Now().Add(-1 * time.Hour).Unix()
		obtainedEVs, err = sut.GlobalEncryptedValueStorage.ListAll(t.Context(), contracts.ListOpts{}, &pastTime)
		require.NoError(t, err)
		require.Empty(t, obtainedEVs)
	})

	t.Run("counting encrypted values returns their total", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		_, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-a", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		_, err = sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-b", "test-name", 1, []byte("test-data"))
		require.NoError(t, err)

		count, err := sut.GlobalEncryptedValueStorage.CountAll(t.Context(), nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), count)

		// Count all encrypted values, until a certain time
		pastTime := time.Now().Add(-1 * time.Hour).Unix()
		count, err = sut.GlobalEncryptedValueStorage.CountAll(t.Context(), &pastTime)
		require.NoError(t, err)
		require.Equal(t, int64(0), count)
	})
}

func TestIntegration_StateMachine(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	t.Parallel()

	tt := t

	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
		m := newModel()

		t.Repeat(map[string]func(*rapid.T){
			"create": func(t *rapid.T) {
				ns := namespaceGen.Draw(t, "ns")
				name := nameGen.Draw(t, "name")
				version := versionGen.Draw(t, "version")
				plaintext := rapid.String().Draw(t, "plaintext")

				_, modelErr := m.create(ns, name, version, []byte(plaintext))
				_, err := sut.EncryptedValueStorage.Create(t.Context(), ns, name, version, []byte(plaintext))
				if modelErr != nil || err != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
			},
			"update": func(t *rapid.T) {
				ns := namespaceGen.Draw(t, "ns")
				name := nameGen.Draw(t, "name")
				version := versionGen.Draw(t, "version")
				plaintext := rapid.String().Draw(t, "plaintext")

				modelErr := m.update(ns, name, version, []byte(plaintext))
				err := sut.EncryptedValueStorage.Update(t.Context(), ns, name, version, []byte(plaintext))
				if modelErr != nil || err != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
			},
			"get": func(t *rapid.T) {
				ns := namespaceGen.Draw(t, "ns")
				name := nameGen.Draw(t, "name")
				version := versionGen.Draw(t, "version")

				modelValue, modelErr := m.get(ns, name, version)
				value, err := sut.EncryptedValueStorage.Get(t.Context(), ns, name, version)
				if modelErr != nil || err != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				// Do not compare timestamps because the model doesn't model them.
				require.Equal(t, modelValue.Namespace, value.Namespace)
				require.Equal(t, modelValue.Name, value.Name)
				require.True(t, bytes.Equal(modelValue.EncryptedData, value.EncryptedData),
					"expected encrypted data to be %+v but got %+v", modelValue.EncryptedData, value.EncryptedData)
				require.Equal(t, modelValue.Version, value.Version)
			},
			"delete": func(t *rapid.T) {
				ns := namespaceGen.Draw(t, "ns")
				name := nameGen.Draw(t, "name")
				version := versionGen.Draw(t, "version")

				modelErr := m.delete(ns, name, version)
				err := sut.EncryptedValueStorage.Delete(t.Context(), ns, name, version)
				if modelErr != nil || err != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
			},
		})
	})
}

var (
	namespaceGen = rapid.Custom(func(t *rapid.T) string {
		return rapid.SampledFrom([]string{"ns1", "ns2", "ns3", "ns4", "ns5"}).Draw(t, "namespace")
	})
	nameGen = rapid.Custom(func(t *rapid.T) string {
		return rapid.SampledFrom([]string{"name1", "name2", "name3", "name4", "name5"}).Draw(t, "name")
	})
	versionGen = rapid.Custom(func(t *rapid.T) int64 {
		return rapid.Int64Range(1, 5).Draw(t, "version")
	})
)

// A simplified model of the encrypted value storage
type model struct {
	entries []*entry
}

type entry struct {
	namespace     string
	name          string
	version       int64
	encryptedData []byte
}

func newModel() *model {
	return &model{}
}

func (m *model) create(namespace, name string, version int64, encryptedData []byte) (*contracts.EncryptedValue, error) {
	v, err := m.get(namespace, name, version)
	if err != nil && !errors.Is(err, encryption.ErrEncryptedValueNotFound) {
		return nil, err
	}
	// The entry being creted already exists
	if v != nil {
		return nil, encryption.ErrEncryptedValueAlreadyExists
	}

	m.entries = append(m.entries, &entry{
		namespace:     namespace,
		name:          name,
		version:       version,
		encryptedData: encryptedData,
	})
	return &contracts.EncryptedValue{
		Namespace:     namespace,
		Name:          name,
		Version:       version,
		EncryptedData: encryptedData,
		Created:       1,
		Updated:       1,
	}, nil
}
func (m *model) update(namespace, name string, version int64, encryptedData []byte) error {
	for _, v := range m.entries {
		if v.namespace == namespace && v.name == name && v.version == version {
			v.encryptedData = encryptedData
			return nil
		}
	}

	return encryption.ErrUnexpectedNumberOfRowsAffected
}

func (m *model) get(namespace, name string, version int64) (*contracts.EncryptedValue, error) {
	for _, v := range m.entries {
		if v.namespace == namespace && v.name == name && v.version == version {
			return &contracts.EncryptedValue{
				Namespace:     namespace,
				Name:          name,
				Version:       version,
				EncryptedData: v.encryptedData,
				Created:       1,
				Updated:       1,
			}, nil
		}
	}

	return nil, encryption.ErrEncryptedValueNotFound
}
func (m *model) delete(namespace, name string, version int64) error {
	m.entries = slices.DeleteFunc(m.entries, func(v *entry) bool {
		return v.namespace == namespace && v.name == name && v.version == version
	})
	return nil
}

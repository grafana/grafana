package encryption_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"slices"
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	cipherService "github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"pgregory.net/rapid"
)

func TestEncryptedValueStoreImpl(t *testing.T) {
	t.Parallel()

	t.Run("creating an encrypted value returns it", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
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
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
		require.NoError(t, err)

		obtainedEV, err := sut.EncryptedValueStorage.Get(t.Context(), xkube.Namespace(createdEV.Namespace), createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		require.Equal(t, createdEV.Namespace, obtainedEV.Namespace)
		require.Equal(t, createdEV.Name, obtainedEV.Name)
		require.Equal(t, createdEV.Created, obtainedEV.Created)
		require.Equal(t, createdEV.Updated, obtainedEV.Updated)
		require.Equal(t, createdEV.EncryptedData, obtainedEV.EncryptedData)
		require.Equal(t, createdEV.DataKeyID, obtainedEV.DataKeyID)
		require.Equal(t, createdEV.Namespace, obtainedEV.Namespace)
	})

	t.Run("get an existent encrypted value with a different namespace returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "ns1", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
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
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
		require.NoError(t, err)

		err = sut.EncryptedValueStorage.Update(t.Context(), xkube.Namespace(createdEV.Namespace), createdEV.Name, createdEV.Version, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id-updated",
			EncryptedData: []byte("test-data-updated"),
		})
		require.NoError(t, err)

		updatedEV, err := sut.EncryptedValueStorage.Get(t.Context(), xkube.Namespace(createdEV.Namespace), createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		require.Equal(t, []byte("test-data-updated"), updatedEV.EncryptedData)
		require.Equal(t, "test-data-key-id-updated", updatedEV.DataKeyID)
		require.Equal(t, createdEV.Created, updatedEV.Created)
		require.Equal(t, createdEV.Namespace, updatedEV.Namespace)
	})

	t.Run("updating a non existing encrypted value returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		err := sut.EncryptedValueStorage.Update(t.Context(), "test-namespace", "test-uid", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
		require.Error(t, err)
	})

	t.Run("delete an existing encrypted value returns error", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		createdEV, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("ttttest-data"),
		})
		require.NoError(t, err)

		_, err = sut.EncryptedValueStorage.Get(t.Context(), xkube.Namespace(createdEV.Namespace), createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		err = sut.EncryptedValueStorage.Delete(t.Context(), xkube.Namespace(createdEV.Namespace), createdEV.Name, createdEV.Version)
		require.NoError(t, err)

		obtainedEV, err := sut.EncryptedValueStorage.Get(t.Context(), xkube.Namespace(createdEV.Namespace), createdEV.Name, createdEV.Version)
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
		createdEvA, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-a", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
		require.NoError(t, err)

		createdEvB, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-b", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
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
		_, err := sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-a", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
		require.NoError(t, err)

		_, err = sut.EncryptedValueStorage.Create(t.Context(), "test-namespace-b", "test-name", 1, contracts.EncryptedPayload{
			DataKeyID:     "test-data-key-id",
			EncryptedData: []byte("test-data"),
		})
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

func TestEncryptedValueMigration(t *testing.T) {
	t.Parallel()

	t.Run("golden path - successful migration of legacy format", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)
		tracer := noop.NewTracerProvider().Tracer("test")
		usageStats := &usagestats.UsageStatsMock{T: t}
		enc, err := cipherService.ProvideAESGCMCipherService(tracer, usageStats)
		require.NoError(t, err)

		testCases := []struct {
			namespace string
			name      string
			version   int64
			plaintext string
			dataKeyId string
		}{
			{
				namespace: "test-namespace-1",
				name:      "test-name-1",
				version:   1,
				plaintext: "test-plaintext-1",
				dataKeyId: "test-data-key-id-1",
			},
			{
				namespace: "test-namespace-1",
				name:      "test-name-2",
				version:   1,
				plaintext: "test-plaintext-2",
				dataKeyId: "test-data-key-id-1",
			},
			{
				namespace: "test-namespace-2",
				name:      "test-name-3",
				version:   1,
				plaintext: "test-plaintext-3",
				dataKeyId: "test-data-key-id-2",
			},
		}

		// Seed with data in the legacy format
		for _, tc := range testCases {
			err := createLegacyEncryptedData(t, sut, enc, tc.namespace, tc.name, tc.version, tc.plaintext, tc.dataKeyId)
			require.NoError(t, err)
		}

		// Run the migration and blindy trust it
		rowsAffected, err := sut.EncryptedValueMigrationExecutor.Execute(t.Context())
		require.NoError(t, err)
		require.Equal(t, len(testCases), rowsAffected)

		// Now validate that the data is in the new format
		encryptedValues, err := sut.GlobalEncryptedValueStorage.ListAll(t.Context(), contracts.ListOpts{}, nil)
		require.NoError(t, err)
		require.Len(t, encryptedValues, 3)

		for _, tc := range testCases {
			ev, err := sut.EncryptedValueStorage.Get(t.Context(), xkube.Namespace(tc.namespace), tc.name, tc.version)
			require.NoError(t, err)

			// Decrypt the encrypted data and check for equality
			decrypted, err := enc.Decrypt(t.Context(), ev.EncryptedData, tc.dataKeyId)
			require.NoError(t, err)
			require.Equal(t, tc.dataKeyId, ev.DataKeyID)
			require.Equal(t, tc.plaintext, string(decrypted))
		}
	})

	t.Run("error conditions - handles corrupt data gracefully", func(t *testing.T) {
		t.Parallel()

		tracer := noop.NewTracerProvider().Tracer("test")
		sut := testutils.Setup(t)

		t.Run("global store list error", func(t *testing.T) {
			mockGlobalStore := &mockGlobalEncryptedValueStorage{
				listAllError: errors.New("database connection failed"),
			}

			migrationExecutor, err := encryption.ProvideEncryptedValueMigrationExecutor(
				sut.Database,
				tracer,
				sut.EncryptedValueStorage,
				mockGlobalStore,
			)
			require.NoError(t, err)

			rowsAffected, err := migrationExecutor.Execute(t.Context())
			require.Error(t, err)
			require.Contains(t, err.Error(), "listing all encrypted values")
			require.Equal(t, 0, rowsAffected)
		})

		t.Run("corrupt data - missing key delimiter", func(t *testing.T) {
			mockGlobalStore := &mockGlobalEncryptedValueStorage{
				encryptedValues: []*contracts.EncryptedValue{
					{
						Namespace: "test-ns",
						Name:      "test-name",
						Version:   1,
						EncryptedPayload: contracts.EncryptedPayload{
							EncryptedData: []byte("corrupt-data-without-delimiter"),
							DataKeyID:     "", // Empty to trigger migration
						},
					},
				},
			}

			migrationExecutor, err := encryption.ProvideEncryptedValueMigrationExecutor(
				sut.Database,
				tracer,
				sut.EncryptedValueStorage,
				mockGlobalStore,
			)
			require.NoError(t, err)

			rowsAffected, err := migrationExecutor.Execute(t.Context())
			require.Error(t, err)
			require.Contains(t, err.Error(), "could not find valid key id in encrypted payload")
			require.Equal(t, 0, rowsAffected)
		})

		t.Run("corrupt data - empty encrypted data", func(t *testing.T) {
			mockGlobalStore := &mockGlobalEncryptedValueStorage{
				encryptedValues: []*contracts.EncryptedValue{
					{
						Namespace: "test-ns",
						Name:      "test-name",
						Version:   1,
						EncryptedPayload: contracts.EncryptedPayload{
							EncryptedData: []byte("#dGVzdA#"), // Valid key but no encrypted data after delimiter
							DataKeyID:     "",                 // Empty to trigger migration
						},
					},
				},
			}

			migrationExecutor, err := encryption.ProvideEncryptedValueMigrationExecutor(
				sut.Database,
				tracer,
				sut.EncryptedValueStorage,
				mockGlobalStore,
			)
			require.NoError(t, err)

			rowsAffected, err := migrationExecutor.Execute(t.Context())
			require.Error(t, err)
			require.Contains(t, err.Error(), "encrypted data is empty")
			require.Equal(t, 0, rowsAffected)
		})

		t.Run("corrupt data - invalid base64 key", func(t *testing.T) {
			mockGlobalStore := &mockGlobalEncryptedValueStorage{
				encryptedValues: []*contracts.EncryptedValue{
					{
						Namespace: "test-ns",
						Name:      "test-name",
						Version:   1,
						EncryptedPayload: contracts.EncryptedPayload{
							EncryptedData: []byte("#invalid-base64!@#$%^&*()#somedata"),
							DataKeyID:     "", // Empty to trigger migration
						},
					},
				},
			}

			migrationExecutor, err := encryption.ProvideEncryptedValueMigrationExecutor(
				sut.Database,
				tracer,
				sut.EncryptedValueStorage,
				mockGlobalStore,
			)
			require.NoError(t, err)

			rowsAffected, err := migrationExecutor.Execute(t.Context())
			require.Error(t, err)
			require.Contains(t, err.Error(), "decoding key id")
			require.Equal(t, 0, rowsAffected)
		})

		t.Run("update failure", func(t *testing.T) {
			mockGlobalStore := &mockGlobalEncryptedValueStorage{
				encryptedValues: []*contracts.EncryptedValue{
					{
						Namespace: "nonexistent-ns",
						Name:      "nonexistent-name",
						Version:   999,
						EncryptedPayload: contracts.EncryptedPayload{
							EncryptedData: []byte("#dGVzdA#someencrypteddata"),
							DataKeyID:     "", // Empty to trigger migration
						},
					},
				},
			}

			migrationExecutor, err := encryption.ProvideEncryptedValueMigrationExecutor(
				sut.Database,
				tracer,
				sut.EncryptedValueStorage,
				mockGlobalStore,
			)
			require.NoError(t, err)

			rowsAffected, err := migrationExecutor.Execute(t.Context())
			require.Error(t, err)
			require.Contains(t, err.Error(), "updating encrypted value")
			require.Equal(t, 0, rowsAffected)
		})
	})
}

// Helper function that bypasses interfaces and creates data in the legacy format directly in the database.
// The format is "#{encoded_key_id}#{encrypted_data}".
func createLegacyEncryptedData(t *testing.T, sut testutils.Sut, enc cipher.Cipher, namespace, name string, version int64, plaintext string, dataKeyId string) error {
	t.Helper()

	encryptedData, err := enc.Encrypt(t.Context(), []byte(plaintext), dataKeyId)
	require.NoError(t, err)

	// Encode using the legacy format
	const keyIdDelimiter = '#'
	prefix := make([]byte, base64.RawStdEncoding.EncodedLen(len(dataKeyId))+2)
	base64.RawStdEncoding.Encode(prefix[1:], []byte(dataKeyId))
	prefix[0] = keyIdDelimiter
	prefix[len(prefix)-1] = keyIdDelimiter

	blob := make([]byte, len(prefix)+len(encryptedData))
	copy(blob, prefix)
	copy(blob[len(prefix):], encryptedData)

	createdTime := time.Now().Unix()

	encryptedValue := &encryption.EncryptedValue{
		Namespace:     namespace,
		Name:          name,
		Version:       version,
		EncryptedData: blob,
		DataKeyID:     "",
		Created:       createdTime,
		Updated:       createdTime,
	}

	req := struct {
		sqltemplate.SQLTemplate
		Row *encryption.EncryptedValue
	}{
		SQLTemplate: sqltemplate.New(sqltemplate.DialectForDriver(sut.Database.DriverName())),
		Row:         encryptedValue,
	}
	tmpl, err := template.ParseFiles("data/encrypted_value_create.sql")
	if err != nil {
		return fmt.Errorf("parsing template: %w", err)
	}

	query, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return fmt.Errorf("executing template: %w", err)
	}

	res, err := sut.Database.ExecContext(t.Context(), query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("inserting row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	} else if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	return nil
}

func TestStateMachine(t *testing.T) {
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
				dataKeyId := rapid.String().Draw(t, "dataKeyId")
				plaintext := rapid.String().Draw(t, "plaintext")

				_, modelErr := m.create(ns, name, version, []byte(plaintext), dataKeyId)
				_, err := sut.EncryptedValueStorage.Create(t.Context(), xkube.Namespace(ns), name, version, contracts.EncryptedPayload{
					DataKeyID:     dataKeyId,
					EncryptedData: []byte(plaintext),
				})
				if modelErr != nil || err != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
			},
			"update": func(t *rapid.T) {
				ns := namespaceGen.Draw(t, "ns")
				name := nameGen.Draw(t, "name")
				version := versionGen.Draw(t, "version")
				dataKeyId := rapid.String().Draw(t, "dataKeyId")
				plaintext := rapid.String().Draw(t, "plaintext")

				modelErr := m.update(ns, name, version, []byte(plaintext), dataKeyId)
				err := sut.EncryptedValueStorage.Update(t.Context(), xkube.Namespace(ns), name, version, contracts.EncryptedPayload{
					DataKeyID:     dataKeyId,
					EncryptedData: []byte(plaintext),
				})
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
				value, err := sut.EncryptedValueStorage.Get(t.Context(), xkube.Namespace(ns), name, version)
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
				err := sut.EncryptedValueStorage.Delete(t.Context(), xkube.Namespace(ns), name, version)
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
	dataKeyId     string
}

func newModel() *model {
	return &model{}
}

func (m *model) create(namespace, name string, version int64, encryptedData []byte, dataKeyId string) (*contracts.EncryptedValue, error) {
	v, err := m.get(namespace, name, version)
	if err != nil && !errors.Is(err, encryption.ErrEncryptedValueNotFound) {
		return nil, err
	}
	// The entry being created already exists
	if v != nil {
		return nil, encryption.ErrEncryptedValueAlreadyExists
	}

	m.entries = append(m.entries, &entry{
		namespace:     namespace,
		name:          name,
		version:       version,
		encryptedData: encryptedData,
		dataKeyId:     dataKeyId,
	})
	return &contracts.EncryptedValue{
		Namespace: namespace,
		Name:      name,
		Version:   version,
		EncryptedPayload: contracts.EncryptedPayload{
			DataKeyID:     dataKeyId,
			EncryptedData: encryptedData,
		},
		Created: 1,
		Updated: 1,
	}, nil
}
func (m *model) update(namespace, name string, version int64, encryptedData []byte, dataKeyId string) error {
	for _, v := range m.entries {
		if v.namespace == namespace && v.name == name && v.version == version {
			v.encryptedData = encryptedData
			v.dataKeyId = dataKeyId
			return nil
		}
	}

	return encryption.ErrUnexpectedNumberOfRowsAffected
}

func (m *model) get(namespace, name string, version int64) (*contracts.EncryptedValue, error) {
	for _, v := range m.entries {
		if v.namespace == namespace && v.name == name && v.version == version {
			return &contracts.EncryptedValue{
				Namespace: namespace,
				Name:      name,
				Version:   version,
				EncryptedPayload: contracts.EncryptedPayload{
					DataKeyID:     v.dataKeyId,
					EncryptedData: v.encryptedData,
				},
				Created: 1,
				Updated: 1,
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

// mockGlobalEncryptedValueStorage is a mock implementation of contracts.GlobalEncryptedValueStorage
// used for testing error conditions in the migration executor
type mockGlobalEncryptedValueStorage struct {
	encryptedValues []*contracts.EncryptedValue
	listAllError    error
	countAllError   error
}

func (m *mockGlobalEncryptedValueStorage) ListAll(ctx context.Context, opts contracts.ListOpts, untilTime *int64) ([]*contracts.EncryptedValue, error) {
	if m.listAllError != nil {
		return nil, m.listAllError
	}
	return m.encryptedValues, nil
}

func (m *mockGlobalEncryptedValueStorage) CountAll(ctx context.Context, untilTime *int64) (int64, error) {
	if m.countAllError != nil {
		return 0, m.countAllError
	}
	return int64(len(m.encryptedValues)), nil
}

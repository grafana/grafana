package encryption

import (
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestEncryptedValueQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlEncryptedValueCreate: {
				{
					Name: "create",
					Data: &createEncryptedValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &EncryptedValue{
							Namespace:     "ns",
							UID:           "abc123",
							EncryptedData: []byte("secret"),
							Created:       1234,
							Updated:       5678,
						},
					},
				},
			},
			sqlEncryptedValueRead: {
				{
					Name: "read",
					Data: &readEncryptedValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						UID:         "abc123",
					},
				},
			},
			sqlEncryptedValueUpdate: {
				{
					Name: "update",
					Data: &updateEncryptedValue{
						SQLTemplate:   mocks.NewTestingSQLTemplate(),
						Namespace:     "ns",
						UID:           "abc123",
						EncryptedData: []byte("secret"),
						Updated:       5679,
					},
				},
			},
			sqlEncryptedValueDelete: {
				{
					Name: "delete",
					Data: &deleteEncryptedValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						UID:         "abc123",
					},
				},
			},
		},
	})
}

func TestDataKeyQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlDataKeyCreate: {
				{
					Name: "create",
					Data: &createDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &SecretDataKey{
							UID:           "abc123",
							Namespace:     "ns",
							Label:         "test-label",
							Provider:      "test-provider",
							EncryptedData: []byte("secret"),
							Active:        true,
							Created:       time.Unix(1234, 0),
							Updated:       time.Unix(5678, 0),
						},
					},
				},
			},
			sqlDataKeyRead: {
				{
					Name: "read",
					Data: &readDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						UID:         "abc123",
					},
				},
			},
			sqlDataKeyReadCurrent: {
				{
					Name: "read-current",
					Data: &readCurrentDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						Label:       "test-label",
					},
				},
			},
			sqlDataKeyList: {
				{
					Name: "list",
					Data: &listDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
					},
				},
			},
			sqlDataKeyDisable: {
				{
					Name: "disable",
					Data: &disableDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						Updated:     time.Unix(5678, 0),
					},
				},
			},
			sqlDataKeyDelete: {
				{
					Name: "delete",
					Data: &deleteDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						UID:         "abc123",
					},
				},
			},
			sqlDataKeyReencrypt: {
				{
					Name: "reencrypt",
					Data: &reencryptDataKey{
						SQLTemplate:      mocks.NewTestingSQLTemplate(),
						SelectStatements: "SELECT uid, label, encrypted_data FROM secret_data_key WHERE namespace = 'ns'",
						Provider:         "new-provider",
						Updated:          time.Unix(5678, 0),
					},
				},
			},
		},
	})
}

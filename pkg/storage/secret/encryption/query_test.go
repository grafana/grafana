package encryption

import (
	"testing"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
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
							Name:          "n1",
							Version:       1,
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
						Name:        "n1",
						Version:     1,
					},
				},
			},
			sqlEncryptedValueUpdate: {
				{
					Name: "update",
					Data: &updateEncryptedValue{
						SQLTemplate:   mocks.NewTestingSQLTemplate(),
						Namespace:     "ns",
						Name:          "n1",
						Version:       1,
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
						Name:        "n1",
						Version:     1,
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
						Row: &contracts.SecretDataKey{
							UID:           "abc123",
							Active:        true,
							Namespace:     "ns",
							Label:         "label",
							Provider:      "provider",
							EncryptedData: []byte("secret"),
						},
					},
				},
				{
					Name: "create-not-active",
					Data: &createDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &contracts.SecretDataKey{
							UID:           "abc123",
							Active:        false,
							Namespace:     "ns",
							Label:         "label",
							Provider:      "provider",
							EncryptedData: []byte("secret"),
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
					Name: "read_current",
					Data: &readCurrentDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						Label:       "label",
					},
				},
			},
			sqlDataKeyList: {
				{
					Name: "list",
					Data: &listDataKeys{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
					},
				},
			},
			sqlDataKeyDisable: {
				{
					Name: "disable",
					Data: &disableDataKeys{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						Updated:     time.Unix(1735689600, 0).UTC(),
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
				{
					Name: "delete-no-uid",
					Data: &deleteDataKey{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						UID:         "",
					},
				},
			},
		},
	})
}

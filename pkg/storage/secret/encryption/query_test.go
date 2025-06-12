package encryption

import (
	"testing"
	"text/template"

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

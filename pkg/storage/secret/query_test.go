package secret

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestSecureValuesQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlSecureValueInsert: {
				{
					Name: "create",
					Data: &createSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &secureValueRow{
							UID:               "abc",
							Namespace:         "ns",
							Name:              "name",
							Title:             "title",
							Manager:           "default",
							Path:              "path", // should not have path and encrypted value!
							EncryptedProvider: "awskms",
							EncryptedKID:      "KeyID",
							EncryptedSalt:     "TheSalt",
							EncryptedValue:    "EncryptedValue",
							Created:           1234,
							CreatedBy:         "user:ryan",
							Updated:           5678,
							UpdatedBy:         "user:cameron",
							Annotations:       `{"x":"XXXX"}`,
							Labels:            `{"a":"AAA", "b", "BBBB"}`,
							APIs:              `["aaa", "bbb", "ccc"]`,
						},
					},
				},
			},
			sqlSecureValueUpdate: {
				{
					Name: "update",
					Data: &updateSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &secureValueRow{
							UID:         "uid",
							Namespace:   "ns",
							Name:        "name",
							Title:       "ttt",
							Manager:     "default",
							Path:        "path",
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							APIs:        `["aaa", "bbb", "ccc"]`,
						},
					},
				},
			},
			sqlSecureValueEvent: {
				{
					Name: "event",
					Data: &writeEvent{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Event: &secureValueEvent{
							Namespace: "ns",
							Name:      "name",
							Timestamp: 1234,
							Action:    "UPDATE",
							Identity:  "user:ryan",
							Details:   "aaa, bbb, ccc",
						},
					},
				},
			},
			sqlSecureValueEncrypt: {
				{
					Name: "event",
					Data: &encryptSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						UID:         "ABCD",
						Timestamp:   12345,
						Encrypted: &EncryptedValue{
							KID:   "KeyID",
							Salt:  "TheSalt",
							Value: "EncryptedValue",
						},
					},
				},
			},
		}})
}

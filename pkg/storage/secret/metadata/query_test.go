package metadata

import (
	"database/sql"
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"k8s.io/utils/ptr"
)

func TestKeeperQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlKeeperCreate: {
				{
					Name: "create",
					Data: &createKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &keeperDB{
							GUID:        "abc",
							Name:        "name",
							Namespace:   "ns",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Description: "description",
							Type:        "sql",
							Payload:     "",
						},
					},
				},
			},
			sqlKeeperDelete: {
				{
					Name: "delete",
					Data: &deleteKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
					},
				},
			},
			sqlKeeperList: {
				{
					Name: "list",
					Data: &listKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
					},
				},
			},
			sqlKeeperRead: {
				{
					Name: "read",
					Data: &readKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
					},
				},
				{
					Name: "read-for-update",
					Data: &readKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						IsForUpdate: true,
					},
				},
			},
			sqlKeeperUpdate: {
				{
					Name: "update",
					Data: &updateKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &keeperDB{
							GUID:        "abc",
							Name:        "name",
							Namespace:   "ns",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Description: "description",
							Type:        "sql",
							Payload:     "",
						},
					},
				},
			},
			sqlKeeperListByName: {
				{
					Name: "list",
					Data: listByNameKeeper{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
						KeeperNames: []string{"a", "b"},
					},
				},
			},
			sqlSecureValueListByName: {
				{
					Name: "list",
					Data: listByNameSecureValue{
						SQLTemplate:      mocks.NewTestingSQLTemplate(),
						Namespace:        "ns",
						UsedSecureValues: []string{"a", "b"},
					},
				},
			},
		},
	})
}

func TestSecureValueQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlSecureValueRead: {
				{
					Name: "read",
					Data: &readSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
					},
				},
				{
					Name: "read-for-update",
					Data: &readSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						IsForUpdate: true,
					},
				},
			},
			sqlSecureValueList: {
				{
					Name: "list",
					Data: &listSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Namespace:   "ns",
					},
				},
			},
			sqlSecureValueCreate: {
				{
					Name: "create-null",
					Data: &createSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &secureValueDB{
							GUID:        "abc",
							Name:        "name",
							Namespace:   "ns",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Phase:       "creating",
							Message:     toNullString(nil),
							Description: "description",
							Keeper:      toNullString(nil),
							Decrypters:  toNullString(nil),
							Ref:         toNullString(nil),
							ExternalID:  "extId",
						},
					},
				},
				{
					Name: "create-not-null",
					Data: &createSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &secureValueDB{
							GUID:        "abc",
							Name:        "name",
							Namespace:   "ns",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Phase:       "creating",
							Message:     toNullString(ptr.To("message_test")),
							Description: "description",
							Keeper:      toNullString(ptr.To("keeper_test")),
							Decrypters:  toNullString(ptr.To("decrypters_test")),
							Ref:         toNullString(ptr.To("ref_test")),
							ExternalID:  "extId",
						},
					},
				},
			},
			sqlSecureValueDelete: {
				{
					Name: "delete",
					Data: &deleteSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
					},
				},
			},
			sqlSecureValueUpdate: {
				{
					Name: "update-null",
					Data: &updateSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						Row: &secureValueDB{
							GUID:        "abc",
							Name:        "name",
							Namespace:   "ns",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Phase:       "creating",
							Message:     toNullString(nil),
							Description: "description",
							Keeper:      toNullString(nil),
							Decrypters:  toNullString(nil),
							Ref:         toNullString(nil),
							ExternalID:  "extId",
						},
					},
				},
				{
					Name: "update-not-null",
					Data: &updateSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						Row: &secureValueDB{
							GUID:        "abc",
							Name:        "name",
							Namespace:   "ns",
							Annotations: `{"x":"XXXX"}`,
							Labels:      `{"a":"AAA", "b", "BBBB"}`,
							Created:     1234,
							CreatedBy:   "user:ryan",
							Updated:     5678,
							UpdatedBy:   "user:cameron",
							Phase:       "creating",
							Message:     toNullString(ptr.To("message_test")),
							Description: "description",
							Keeper:      toNullString(ptr.To("keeper_test")),
							Decrypters:  toNullString(ptr.To("decrypters_test")),
							Ref:         toNullString(ptr.To("ref_test")),
							ExternalID:  "extId",
						},
					},
				},
			},
			sqlSecureValueUpdateExternalId: {
				{
					Name: "updateExternalId",
					Data: &updateExternalIdSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						ExternalID:  "extId",
					},
				},
			},
			sqlSecureValueUpdateStatus: {
				{
					Name: "updateStatus",
					Data: &updateStatusSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						Phase:       "Succeeded",
					},
				},
			},
			sqlSecureValueReadForDecrypt: {
				{
					Name: "read-for-decrypt",
					Data: &readSecureValueForDecrypt{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
					},
				},
			},
		},
	})
}

func TestSecureValueOutboxQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlSecureValueOutboxAppend: {
				{
					Name: "no-encrypted-secret",
					Data: &appendSecureValueOutbox{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &outboxMessageDB{
							MessageID:   "my-uuid",
							MessageType: "some-type",
							Name:        "name",
							Namespace:   "namespace",
							ExternalID:  sql.NullString{Valid: true, String: "external-id"},
							KeeperName:  sql.NullString{Valid: true, String: "keeper"},
							Created:     1234,
						},
					},
				},
				{
					Name: "no-external-id",
					Data: &appendSecureValueOutbox{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &outboxMessageDB{
							MessageID:       "my-uuid",
							MessageType:     "some-type",
							Name:            "name",
							Namespace:       "namespace",
							EncryptedSecret: sql.NullString{Valid: true, String: "encrypted"},
							KeeperName:      sql.NullString{Valid: true, String: "keeper"},
							Created:         1234,
						},
					},
				},
				{
					Name: "no-keeper-name",
					Data: &appendSecureValueOutbox{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &outboxMessageDB{
							MessageID:       "my-uuid",
							MessageType:     "some-type",
							Name:            "name",
							Namespace:       "namespace",
							EncryptedSecret: sql.NullString{Valid: true, String: "encrypted"},
							ExternalID:      sql.NullString{Valid: true, String: "external-id"},
							Created:         1234,
						},
					},
				},
				{
					Name: "all-fields-present",
					Data: &appendSecureValueOutbox{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &outboxMessageDB{
							MessageID:       "my-uuid",
							MessageType:     "some-type",
							Name:            "name",
							Namespace:       "namespace",
							EncryptedSecret: sql.NullString{Valid: true, String: "encrypted"},
							ExternalID:      sql.NullString{Valid: true, String: ""}, // can be empty string
							KeeperName:      sql.NullString{Valid: true, String: "keeper"},
							Created:         1234,
						},
					},
				},
			},

			sqlSecureValueOutboxReceiveN: {
				{
					Name: "basic",
					Data: &receiveNSecureValueOutbox{
						SQLTemplate:  mocks.NewTestingSQLTemplate(),
						ReceiveLimit: 10,
					},
				},
			},

			sqlSecureValueOutboxDelete: {
				{
					Name: "basic",
					Data: &deleteSecureValueOutbox{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						MessageID:   "my-uuid",
					},
				},
			},
		},
	})
}

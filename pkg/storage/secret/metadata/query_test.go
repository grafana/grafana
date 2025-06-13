package metadata

import (
	"database/sql"
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
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
		},
	})
}

func TestSecureValueOutboxQueries(t *testing.T) {
	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir: "testdata",
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlSecureValueOutboxUpdateReceiveCount: {
				{

					Name: "update-receive-count",
					Data: &incrementReceiveCountOutbox{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						MessageIDs:  []string{"id1", "id2", "id3"},
					},
				},
			},
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

package metadata

import (
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
							Title:       "title",
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
							Title:       "title",
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
						SQLTemplate:      mocks.NewTestingSQLTemplate(),
						Namespace:        "ns",
						KeeperNames:      []string{"a", "b"},
						ExcludeSQLKeeper: "sql",
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
			/** Not yet implemented
			sqlSecureValueCreate: {
				{
					Name: "create",
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
							Message:     nil,
							Title:       "title",
							Keeper:      ptr.To("keeper"),
							Decrypters:  nil,
							Ref:         nil,
							ExternalID:  "extId",
						},
					},
				},
			},
			*/
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
			/** Not yet implemented
				sqlSecureValueUpdate: {
				{
					Name: "update",
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
							Message:     nil,
							Title:       "title",
							Keeper:      ptr.To("keeper"),
							Decrypters:  nil,
							Ref:         nil,
							ExternalID:  "extId",
						},
					},
				},
			},
			*/
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
		},
	})
}

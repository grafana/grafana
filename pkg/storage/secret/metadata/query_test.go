package metadata

import (
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
			sqlGetLatestSecureValueVersion: {
				{
					Name: "get latest secure value version",
					Data: &getLatestSecureValueVersion{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
					},
				},
			},
			sqlSecureValueSetVersionToActive: {
				{
					Name: "set secure value version to active",
					Data: &secureValueSetVersionToActive{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Name:        "name",
						Namespace:   "ns",
						Version:     1,
					},
				},
			},
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
							GUID:                     "abc",
							Name:                     "name",
							Namespace:                "ns",
							Annotations:              `{"x":"XXXX"}`,
							Labels:                   `{"a":"AAA", "b", "BBBB"}`,
							Created:                  1234,
							CreatedBy:                "user:ryan",
							Updated:                  5678,
							UpdatedBy:                "user:cameron",
							Version:                  1,
							Description:              "description",
							Keeper:                   toNullString(nil),
							Decrypters:               toNullString(nil),
							Ref:                      toNullString(nil),
							ExternalID:               "extId",
							OwnerReferenceAPIVersion: toNullString(nil),
							OwnerReferenceKind:       toNullString(nil),
							OwnerReferenceName:       toNullString(nil),
							OwnerReferenceUID:        toNullString(nil),
						},
					},
				},
				{
					Name: "create-not-null",
					Data: &createSecureValue{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						Row: &secureValueDB{
							GUID:                     "abc",
							Name:                     "name",
							Namespace:                "ns",
							Annotations:              `{"x":"XXXX"}`,
							Labels:                   `{"a":"AAA", "b", "BBBB"}`,
							Created:                  1234,
							CreatedBy:                "user:ryan",
							Updated:                  5678,
							UpdatedBy:                "user:cameron",
							Version:                  1,
							Description:              "description",
							Keeper:                   toNullString(ptr.To("keeper_test")),
							Decrypters:               toNullString(ptr.To("decrypters_test")),
							Ref:                      toNullString(ptr.To("ref_test")),
							ExternalID:               "extId",
							OwnerReferenceAPIVersion: toNullString(ptr.To("prometheus.datasource.grafana.com/v1alpha1")),
							OwnerReferenceKind:       toNullString(ptr.To("DataSourceConfig")),
							OwnerReferenceName:       toNullString(ptr.To("prom-config")),
							OwnerReferenceUID:        toNullString(ptr.To("1234")),
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
			sqlSecureValueMatchingOwner: {
				{
					Name: "matchingOwner",
					Data: &secureValueMatchingOwner{
						SQLTemplate:              mocks.NewTestingSQLTemplate(),
						Namespace:                "ns",
						OwnerReferenceAPIVersion: "prometheus.datasource.grafana.com/v1alpha1",
						OwnerReferenceKind:       "DataSourceConfig",
						OwnerReferenceName:       "prom-config",
						OwnerReferenceUID:        "1234",
					},
				},
			},
		},
	})
}

package metadata

import (
	"os/exec"
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/stretchr/testify/require"
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

func TestFoo(t *testing.T) {
	const n = 10_000

	for range n {
		t.Run("", func(t *testing.T) {
			t.Parallel()
			cmd := exec.Command("curl", "-X", "POST", "-H", "Content-Type: application/yaml", "--data-binary", "@/Users/brunofelipefrancisco/dev/grafana/pkg/extensions/apiserver/tests/secret/testdata/secure-value-default-generate.yaml", "http://admin:admin@localhost:3000/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues")
			require.NoError(t, cmd.Run())
		})
	}

	// wg := sync.WaitGroup{}
	// wg.Add(n)

	// for range n {
	// 	go func(wg *sync.WaitGroup) {
	// 		defer wg.Done()
	// 		cmd := exec.Command("curl", "-X", "POST", "-H", "Content-Type: application/yaml", "--data-binary", "@/Users/brunofelipefrancisco/dev/grafana/pkg/extensions/apiserver/tests/secret/testdata/secure-value-default-generate.yaml", "http://admin:admin@localhost:3000/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues")
	// 		require.NoError(t, cmd.Run())
	// 	}(&wg)
	// }

	// wg.Wait()
}

package store_test

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const testAlertingIntervalSeconds = 10

func TestIntegrationProvisioningStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []struct {
		name           string
		featureEnabled bool
	}{
		{
			name:           "without feature flag",
			featureEnabled: false,
		},
		{
			name:           "with feature flag",
			featureEnabled: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ng, dbStore := tests.SetupTestEnv(t, testAlertingIntervalSeconds)
			if tc.featureEnabled {
				dbStore.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertingProvenanceLockWrites)
			}
			store := createProvisioningStoreSut(ng, dbStore)

			t.Run("Default provenance of a known type is None", func(t *testing.T) {
				rule := models.AlertRule{
					UID: "asdf",
				}

				provenance, err := store.GetProvenance(context.Background(), &rule, 1)

				require.NoError(t, err)
				require.Equal(t, models.ProvenanceNone, provenance)
			})

			t.Run("Store returns saved provenance type", func(t *testing.T) {
				rule := models.AlertRule{
					UID: "123",
				}
				err := store.SetProvenance(context.Background(), &rule, 1, models.ProvenanceFile)
				require.NoError(t, err)

				p, err := store.GetProvenance(context.Background(), &rule, 1)

				require.NoError(t, err)
				require.Equal(t, models.ProvenanceFile, p)
			})

			t.Run("Store does not get provenance of record with different org ID", func(t *testing.T) {
				ruleOrg2 := models.AlertRule{
					UID: "456",
				}
				ruleOrg3 := models.AlertRule{
					UID: "456",
				}
				err := store.SetProvenance(context.Background(), &ruleOrg2, 2, models.ProvenanceFile)
				require.NoError(t, err)

				p, err := store.GetProvenance(context.Background(), &ruleOrg3, 3)

				require.NoError(t, err)
				require.Equal(t, models.ProvenanceNone, p)
			})

			t.Run("Store only updates provenance of record with given org ID", func(t *testing.T) {
				ruleOrg2 := models.AlertRule{
					UID:   "789",
					OrgID: 2,
				}
				ruleOrg3 := models.AlertRule{
					UID:   "789",
					OrgID: 3,
				}
				err := store.SetProvenance(context.Background(), &ruleOrg2, 2, models.ProvenanceFile)
				require.NoError(t, err)
				err = store.SetProvenance(context.Background(), &ruleOrg3, 3, models.ProvenanceFile)
				require.NoError(t, err)

				err = store.SetProvenance(context.Background(), &ruleOrg2, 2, models.ProvenanceAPI)
				require.NoError(t, err)

				p, err := store.GetProvenance(context.Background(), &ruleOrg2, 2)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceAPI, p)
				p, err = store.GetProvenance(context.Background(), &ruleOrg3, 3)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceFile, p)
			})

			t.Run("Store should return all provenances by type", func(t *testing.T) {
				const orgID = 123
				rule1 := models.AlertRule{
					UID:   "789",
					OrgID: orgID,
				}
				rule2 := models.AlertRule{
					UID:   "790",
					OrgID: orgID,
				}
				err := store.SetProvenance(context.Background(), &rule1, orgID, models.ProvenanceFile)
				require.NoError(t, err)
				err = store.SetProvenance(context.Background(), &rule2, orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				p, err := store.GetProvenances(context.Background(), orgID, rule1.ResourceType())
				require.NoError(t, err)
				require.Len(t, p, 2)
				require.Equal(t, models.ProvenanceFile, p[rule1.UID])
				require.Equal(t, models.ProvenanceAPI, p[rule2.UID])
			})

			t.Run("Store should return provenances by UIDs", func(t *testing.T) {
				const orgID = 124
				rule1 := models.AlertRule{UID: "uid-1", OrgID: orgID}
				rule2 := models.AlertRule{UID: "uid-2", OrgID: orgID}
				rule3 := models.AlertRule{UID: "uid-3", OrgID: orgID}

				err := store.SetProvenance(context.Background(), &rule1, orgID, models.ProvenanceFile)
				require.NoError(t, err)
				err = store.SetProvenance(context.Background(), &rule2, orgID, models.ProvenanceAPI)
				require.NoError(t, err)
				err = store.SetProvenance(context.Background(), &rule3, orgID, models.ProvenanceFile)
				require.NoError(t, err)

				// Fetch only rule1 and rule2
				p, err := store.GetProvenancesByUIDs(context.Background(), orgID, rule1.ResourceType(), []string{rule1.UID, rule2.UID})
				require.NoError(t, err)
				require.Len(t, p, 2)
				require.Equal(t, models.ProvenanceFile, p[rule1.UID])
				require.Equal(t, models.ProvenanceAPI, p[rule2.UID])
				_, exists := p[rule3.UID]
				require.False(t, exists)
			})

			t.Run("GetProvenancesByUIDs returns empty map for empty UIDs", func(t *testing.T) {
				p, err := store.GetProvenancesByUIDs(context.Background(), 1, "alertRule", []string{})
				require.NoError(t, err)
				require.Empty(t, p)
			})

			t.Run("GetProvenancesByUIDs respects org ID", func(t *testing.T) {
				const orgID1 = 125
				const orgID2 = 126
				rule := models.AlertRule{UID: "cross-org-uid"}

				err := store.SetProvenance(context.Background(), &rule, orgID1, models.ProvenanceFile)
				require.NoError(t, err)

				// Should not find in different org
				p, err := store.GetProvenancesByUIDs(context.Background(), orgID2, rule.ResourceType(), []string{rule.UID})
				require.NoError(t, err)
				require.Empty(t, p)

				// Should find in correct org
				p, err = store.GetProvenancesByUIDs(context.Background(), orgID1, rule.ResourceType(), []string{rule.UID})
				require.NoError(t, err)
				require.Len(t, p, 1)
				require.Equal(t, models.ProvenanceFile, p[rule.UID])
			})

			t.Run("Store should delete provenance correctly", func(t *testing.T) {
				const orgID = 1234
				ruleOrg := models.AlertRule{
					UID:   "7834539",
					OrgID: orgID,
				}
				err := store.SetProvenance(context.Background(), &ruleOrg, orgID, models.ProvenanceFile)
				require.NoError(t, err)
				p, err := store.GetProvenance(context.Background(), &ruleOrg, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceFile, p)

				err = store.DeleteProvenance(context.Background(), &ruleOrg, orgID)
				require.NoError(t, err)

				p, err = store.GetProvenance(context.Background(), &ruleOrg, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceNone, p)
			})
		})
	}
}

func TestIntegrationProvisioningStoreManagerProperties(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []struct {
		name           string
		featureEnabled bool
	}{
		{name: "without feature flag", featureEnabled: false},
		{name: "with feature flag", featureEnabled: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ng, dbStore := tests.SetupTestEnv(t, testAlertingIntervalSeconds)
			if tc.featureEnabled {
				dbStore.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertingProvenanceLockWrites)
			}
			store := createProvisioningStoreSut(ng, dbStore)

			t.Run("Default manager properties of an unset record are empty", func(t *testing.T) {
				rule := models.AlertRule{UID: "mp-unset"}

				mp, err := store.GetManagerProperties(context.Background(), &rule, 1)

				require.NoError(t, err)
				require.Equal(t, utils.ManagerProperties{}, mp)
			})

			t.Run("SetManagerProperties round-trips kind and identity", func(t *testing.T) {
				const orgID = 1
				rule := models.AlertRule{UID: "mp-terraform", OrgID: orgID}
				want := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "my-workspace"}

				err := store.SetManagerProperties(context.Background(), &rule, orgID, want)
				require.NoError(t, err)

				got, err := store.GetManagerProperties(context.Background(), &rule, orgID)
				require.NoError(t, err)
				require.Equal(t, want, got)

				// The legacy provenance column is kept in sync (terraform maps to api).
				p, err := store.GetProvenance(context.Background(), &rule, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceAPI, p)
			})

			t.Run("SetProvenance keeps manager_kind in sync so GetManagerProperties reflects it", func(t *testing.T) {
				const orgID = 1
				rule := models.AlertRule{UID: "mp-from-provenance", OrgID: orgID}

				err := store.SetProvenance(context.Background(), &rule, orgID, models.ProvenanceFile)
				require.NoError(t, err)

				mp, err := store.GetManagerProperties(context.Background(), &rule, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceToManagerProperties(models.ProvenanceFile), mp)
				require.True(t, mp.Kind.IsClassic())
			})

			t.Run("SetProvenance preserves a stored specific manager when provenance is unchanged", func(t *testing.T) {
				// Terraform collapses to ProvenanceAPI on the legacy API. A legacy
				// write carrying that same coarse provenance is not a request to
				// downgrade the manager to classic-api-provisioning; it is the only
				// value the legacy API can express. The stored terraform manager
				// (and its identity) must survive the write.
				const orgID = 1
				rule := models.AlertRule{UID: "mp-preserve", OrgID: orgID}

				err := store.SetManagerProperties(context.Background(), &rule, orgID, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "ws"})
				require.NoError(t, err)

				err = store.SetProvenance(context.Background(), &rule, orgID, models.ProvenanceAPI)
				require.NoError(t, err)

				mp, err := store.GetManagerProperties(context.Background(), &rule, orgID)
				require.NoError(t, err)
				require.Equal(t, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "ws"}, mp,
					"stored terraform manager and identity must not be clobbered by a legacy api provenance write")
			})

			t.Run("SetProvenance re-derives the manager on a genuine provenance change", func(t *testing.T) {
				// Moving a terraform-managed rule (coarse: api) to file provenance
				// is a real change of provenance, not just the coarse view of the
				// stored manager, so the manager is re-derived and the identity dropped.
				const orgID = 1
				rule := models.AlertRule{UID: "mp-overwrite", OrgID: orgID}

				err := store.SetManagerProperties(context.Background(), &rule, orgID, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "ws"})
				require.NoError(t, err)

				err = store.SetProvenance(context.Background(), &rule, orgID, models.ProvenanceFile)
				require.NoError(t, err)

				mp, err := store.GetManagerProperties(context.Background(), &rule, orgID)
				require.NoError(t, err)
				require.Equal(t, models.ProvenanceToManagerProperties(models.ProvenanceFile), mp)
				require.Empty(t, mp.Identity)
			})

			t.Run("GetManagerPropertiesByUIDs returns properties and respects org + UID filters", func(t *testing.T) {
				const orgID = 200
				ruleTF := models.AlertRule{UID: "mp-by-uid-tf", OrgID: orgID}
				ruleFile := models.AlertRule{UID: "mp-by-uid-file", OrgID: orgID}
				ruleOther := models.AlertRule{UID: "mp-by-uid-other", OrgID: orgID}

				require.NoError(t, store.SetManagerProperties(context.Background(), &ruleTF, orgID, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "ws"}))
				require.NoError(t, store.SetProvenance(context.Background(), &ruleFile, orgID, models.ProvenanceFile))
				require.NoError(t, store.SetProvenance(context.Background(), &ruleOther, orgID, models.ProvenanceAPI))

				got, err := store.GetManagerPropertiesByUIDs(context.Background(), orgID, ruleTF.ResourceType(), []string{ruleTF.UID, ruleFile.UID})
				require.NoError(t, err)
				require.Len(t, got, 2)
				require.Equal(t, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "ws"}, got[ruleTF.UID])
				require.Equal(t, models.ProvenanceToManagerProperties(models.ProvenanceFile), got[ruleFile.UID])
				_, exists := got[ruleOther.UID]
				require.False(t, exists)
			})

			t.Run("GetManagerPropertiesByUIDs returns empty map for empty UIDs", func(t *testing.T) {
				got, err := store.GetManagerPropertiesByUIDs(context.Background(), 1, (&models.AlertRule{}).ResourceType(), []string{})
				require.NoError(t, err)
				require.Empty(t, got)
			})

			t.Run("GetManagerProperties is scoped by org", func(t *testing.T) {
				rule := models.AlertRule{UID: "mp-cross-org"}
				require.NoError(t, store.SetManagerProperties(context.Background(), &rule, 301, utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "ws"}))

				mp, err := store.GetManagerProperties(context.Background(), &rule, 302)
				require.NoError(t, err)
				require.Equal(t, utils.ManagerProperties{}, mp)
			})
		})
	}
}

func TestIntegrationSetProvenance_DeadlockScenarios(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// The deadlock class this test targets is specific to MySQL's gap/insert-intention locks
	// (see setProvenanceWithLocking, gated by FlagAlertingProvenanceLockWrites). On SQLite,
	// SELECT ... FOR UPDATE is a no-op and the single-writer model makes 20 concurrent
	// transactions contend on busy_timeout, producing SQLITE_BUSY rather than exercising
	// the fix.
	if db.IsTestDbSQLite() {
		t.Skip("DeadlockScenarios targets MySQL gap-lock semantics; skipped on SQLite")
	}

	ng, dbStore := tests.SetupTestEnv(t, testAlertingIntervalSeconds)
	dbStore.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertingProvenanceLockWrites)
	store := createProvisioningStoreSut(ng, dbStore)
	concurrency := 20

	t.Run("Same record, different orgs", func(t *testing.T) {
		rule := &models.AlertRule{UID: "same-record-diff-orgs"}

		var wg sync.WaitGroup
		for i := range concurrency {
			wg.Add(1)
			go func(orgID int64) {
				defer wg.Done()
				time.Sleep(time.Microsecond * time.Duration(rand.Intn(100)))
				err := store.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI)
				require.NoError(t, err)
			}(int64(i + 1))
		}
		wg.Wait()
	})

	t.Run("Different records, same org", func(t *testing.T) {
		orgID := int64(1)

		var wg sync.WaitGroup
		for i := range concurrency {
			wg.Add(1)
			go func(uid string) {
				defer wg.Done()
				time.Sleep(time.Microsecond * time.Duration(rand.Intn(100)))
				rule := &models.AlertRule{UID: uid}
				err := store.SetProvenance(context.Background(), rule, orgID, models.ProvenanceFile)
				require.NoError(t, err)
			}(fmt.Sprintf("diff-record-same-org-%d", i))
		}
		wg.Wait()
	})

	t.Run("Mixed operations", func(t *testing.T) {
		rule := &models.AlertRule{UID: "mixed-ops"}
		orgID := int64(1)

		var wg sync.WaitGroup
		// Mix SetProvenance and GetProvenance operations
		for range concurrency {
			wg.Add(1)
			go func() {
				defer wg.Done()
				time.Sleep(time.Microsecond * time.Duration(rand.Intn(100)))
				err := store.SetProvenance(context.Background(), rule, orgID, models.ProvenanceAPI)
				require.NoError(t, err)
			}()

			wg.Add(1)
			go func() {
				defer wg.Done()
				time.Sleep(time.Microsecond * time.Duration(rand.Intn(100)))
				_, err := store.GetProvenance(context.Background(), rule, orgID)
				require.NoError(t, err)
			}()
		}
		wg.Wait()
	})
}

func createProvisioningStoreSut(_ *ngalert.AlertNG, db *store.DBstore) provisioning.ProvisioningStore {
	return db
}

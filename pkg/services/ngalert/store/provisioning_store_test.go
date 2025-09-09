package store_test

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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

func TestIntegrationSetProvenance_DeadlockScenarios(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

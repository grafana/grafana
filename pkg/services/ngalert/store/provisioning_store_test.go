package store_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

const testAlertingIntervalSeconds = 10

func TestIntegrationProvisioningStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	store := createProvisioningStoreSut(tests.SetupTestEnv(t, testAlertingIntervalSeconds))

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
}

func createProvisioningStoreSut(_ *ngalert.AlertNG, db *store.DBstore) provisioning.ProvisioningStore {
	return db
}

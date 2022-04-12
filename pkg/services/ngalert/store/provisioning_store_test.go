package store_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/stretchr/testify/require"
)

const testAlertingIntervalSeconds = 10

func TestProvisioningStore(t *testing.T) {
	store := createProvisioningStoreSut(tests.SetupTestEnv(t, testAlertingIntervalSeconds))

	t.Run("Default provenance of a known type is None", func(t *testing.T) {
		rule := models.AlertRule{
			UID: "asdf",
		}

		provenance, err := store.GetProvenance(context.Background(), &rule)

		require.NoError(t, err)
		require.Equal(t, models.ProvenanceNone, provenance)
	})

	t.Run("Store returns saved provenance type", func(t *testing.T) {
		rule := models.AlertRule{
			UID: "123",
		}
		err := store.SetProvenance(context.Background(), &rule, models.ProvenanceFile)
		require.NoError(t, err)

		p, err := store.GetProvenance(context.Background(), &rule)

		require.NoError(t, err)
		require.Equal(t, models.ProvenanceFile, p)
	})

	t.Run("Store does not get provenance of record with different org ID", func(t *testing.T) {
		ruleOrg2 := models.AlertRule{
			UID:   "456",
			OrgID: 2,
		}
		ruleOrg3 := models.AlertRule{
			UID:   "456",
			OrgID: 3,
		}
		err := store.SetProvenance(context.Background(), &ruleOrg2, models.ProvenanceFile)
		require.NoError(t, err)

		p, err := store.GetProvenance(context.Background(), &ruleOrg3)

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
		err := store.SetProvenance(context.Background(), &ruleOrg2, models.ProvenanceFile)
		require.NoError(t, err)
		err = store.SetProvenance(context.Background(), &ruleOrg3, models.ProvenanceFile)
		require.NoError(t, err)

		err = store.SetProvenance(context.Background(), &ruleOrg2, models.ProvenanceAPI)
		require.NoError(t, err)

		p, err := store.GetProvenance(context.Background(), &ruleOrg2)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceAPI, p)
		p, err = store.GetProvenance(context.Background(), &ruleOrg3)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceFile, p)
	})

	t.Run("Store should return all provenances by type", func(t *testing.T) {
		const orgID = 123
		ruleOrg1 := models.AlertRule{
			UID:   "789",
			OrgID: orgID,
		}
		ruleOrg2 := models.AlertRule{
			UID:   "790",
			OrgID: orgID,
		}
		err := store.SetProvenance(context.Background(), &ruleOrg1, models.ProvenanceFile)
		require.NoError(t, err)
		err = store.SetProvenance(context.Background(), &ruleOrg2, models.ProvenanceAPI)
		require.NoError(t, err)

		p, err := store.GetProvenances(context.Background(), orgID, ruleOrg1.ResourceType())
		require.NoError(t, err)
		require.Len(t, p, 2)
		require.Equal(t, models.ProvenanceFile, p[ruleOrg1.UID])
		require.Equal(t, models.ProvenanceAPI, p[ruleOrg2.UID])
	})

	t.Run("Store should delete provenance correctly", func(t *testing.T) {
		const orgID = 1234
		ruleOrg := models.AlertRule{
			UID:   "7834539",
			OrgID: orgID,
		}
		err := store.SetProvenance(context.Background(), &ruleOrg, models.ProvenanceFile)
		require.NoError(t, err)
		p, err := store.GetProvenance(context.Background(), &ruleOrg)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceFile, p)

		err = store.DeleteProvenance(context.Background(), &ruleOrg)
		require.NoError(t, err)

		p, err = store.GetProvenance(context.Background(), &ruleOrg)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceNone, p)
	})
}

func createProvisioningStoreSut(_ *ngalert.AlertNG, db *store.DBstore) provisioning.ProvisioningStore {
	return db
}

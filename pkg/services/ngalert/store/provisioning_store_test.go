package store_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
	"github.com/stretchr/testify/require"
)

const testAlertingIntervalSeconds = 10

func TestProvisioningStore(t *testing.T) {
	store, xact := createSut(tests.SetupTestEnv(t, testAlertingIntervalSeconds))

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

		err = store.SetProvenance(context.Background(), &ruleOrg2, models.ProvenanceApi)
		require.NoError(t, err)

		p, err := store.GetProvenance(context.Background(), &ruleOrg2)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceApi, p)
		p, err = store.GetProvenance(context.Background(), &ruleOrg3)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceFile, p)
	})

	t.Run("Store saves provenance type when contextual transaction is applied", func(t *testing.T) {
		rule := models.AlertRule{
			UID: "456",
		}

		err := xact.InTransaction(context.Background(), func(ctx context.Context) error {
			return store.SetProvenance(ctx, &rule, models.ProvenanceFile)
		})
		require.NoError(t, err)

		provenance, err := store.GetProvenance(context.Background(), &rule)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceFile, provenance)
	})

	t.Run("Contextual transaction which errors before saving rolls back type update", func(t *testing.T) {
		rule := models.AlertRule{
			UID: "789",
		}

		_ = xact.InTransaction(context.Background(), func(ctx context.Context) error {
			err := store.SetProvenance(ctx, &rule, models.ProvenanceFile)
			require.NoError(t, err)
			return fmt.Errorf("something happened!")
		})

		provenance, err := store.GetProvenance(context.Background(), &rule)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceNone, provenance)
	})
}

func createSut(_ *ngalert.AlertNG, db *store.DBstore) (store.ProvisioningStore, store.TransactionManager) {
	return db, db
}

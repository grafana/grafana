package provisioning

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestNotificationPolicyService(t *testing.T) {
	t.Run("service gets policy tree from org's AM config", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		tree, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)

		require.Equal(t, "grafana-default-email", tree.Receiver)
	})

	t.Run("service stitches policy tree into org's AM config", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		newRoute := createTestRoutingTree()

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.NoError(t, err)

		updated, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, "a new receiver", updated.Receiver)
	})

	t.Run("default provenance of records is none", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		tree, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)

		require.Equal(t, models.ProvenanceNone, tree.Provenance)
	})

	t.Run("service returns upgraded provenance value", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		newRoute := createTestRoutingTree()

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceAPI)
		require.NoError(t, err)

		updated, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceAPI, updated.Provenance)
	})

	t.Run("service respects concurrency token when updating", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		newRoute := createTestRoutingTree()
		q := models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		err := sut.GetAMConfigStore().GetLatestAlertmanagerConfiguration(context.Background(), &q)
		require.NoError(t, err)
		expectedConcurrencyToken := q.Result.ConfigurationHash

		err = sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceAPI)
		require.NoError(t, err)

		fake := sut.GetAMConfigStore().(*fakeAMConfigStore)
		intercepted := fake.lastSaveCommand
		require.Equal(t, expectedConcurrencyToken, intercepted.FetchedConfigurationHash)
	})

	t.Run("updating invalid route returns ValidationError", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		invalid := createTestRoutingTree()
		repeat := model.Duration(0)
		invalid.RepeatInterval = &repeat

		err := sut.UpdatePolicyTree(context.Background(), 1, invalid, models.ProvenanceNone)

		require.Error(t, err)
		require.ErrorIs(t, err, ErrValidation)
	})
}

func createNotificationPolicyServiceSut() *NotificationPolicyService {
	return &NotificationPolicyService{
		amStore:         newFakeAMConfigStore(),
		provenanceStore: NewFakeProvisioningStore(),
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
	}
}

func createTestRoutingTree() definitions.Route {
	return definitions.Route{
		Receiver: "a new receiver",
	}
}

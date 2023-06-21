package provisioning

import (
	"context"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNotificationPolicyService(t *testing.T) {
	t.Run("service gets policy tree from org's AM config", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		tree, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)

		require.Equal(t, "grafana-default-email", tree.Receiver)
	})

	t.Run("error if referenced mute time interval is not existing", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		sut.amStore = &MockAMConfigStore{}
		cfg := createTestAlertingConfig()
		cfg.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{
			{
				Name:          "not-the-one-we-need",
				TimeIntervals: []timeinterval.TimeInterval{},
			},
		}
		data, _ := serializeAlertmanagerConfig(*cfg)
		sut.amStore.(*MockAMConfigStore).On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		sut.amStore.(*MockAMConfigStore).EXPECT().
			UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Return(nil)
		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver:          "a new receiver",
			MuteTimeIntervals: []string{"not-existing"},
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.Error(t, err)
	})

	t.Run("pass if referenced mute time interval is existing", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		sut.amStore = &MockAMConfigStore{}
		cfg := createTestAlertingConfig()
		cfg.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{
			{
				Name:          "existing",
				TimeIntervals: []timeinterval.TimeInterval{},
			},
		}
		data, _ := serializeAlertmanagerConfig(*cfg)
		sut.amStore.(*MockAMConfigStore).On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		sut.amStore.(*MockAMConfigStore).EXPECT().
			UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Return(nil)
		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver:          "a new receiver",
			MuteTimeIntervals: []string{"existing"},
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.NoError(t, err)
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

	t.Run("not existing receiver reference will error", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver: "not-existing",
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.Error(t, err)
	})

	t.Run("existing receiver reference will pass", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		sut.amStore = &MockAMConfigStore{}
		cfg := createTestAlertingConfig()
		data, _ := serializeAlertmanagerConfig(*cfg)
		sut.amStore.(*MockAMConfigStore).On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		sut.amStore.(*MockAMConfigStore).EXPECT().
			UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Return(nil)
		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver: "existing",
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.NoError(t, err)
	})

	t.Run("default provenance of records is none", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		tree, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)

		require.Equal(t, models.ProvenanceNone, models.Provenance(tree.Provenance))
	})

	t.Run("service returns upgraded provenance value", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		newRoute := createTestRoutingTree()

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceAPI)
		require.NoError(t, err)

		updated, err := sut.GetPolicyTree(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceAPI, models.Provenance(updated.Provenance))
	})

	t.Run("service respects concurrency token when updating", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		newRoute := createTestRoutingTree()
		q := models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		config, err := sut.GetAMConfigStore().GetLatestAlertmanagerConfiguration(context.Background(), &q)
		require.NoError(t, err)
		expectedConcurrencyToken := config.ConfigurationHash

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

	t.Run("deleting route replaces with default", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		tree, err := sut.ResetPolicyTree(context.Background(), 1)

		require.NoError(t, err)
		require.Equal(t, "grafana-default-email", tree.Receiver)
		require.Nil(t, tree.Routes)
		require.Equal(t, []model.LabelName{models.FolderTitleLabel, model.AlertNameLabel}, tree.GroupBy)
	})

	t.Run("deleting route with missing default receiver restores receiver", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		sut.amStore = &MockAMConfigStore{}
		cfg := createTestAlertingConfig()
		cfg.AlertmanagerConfig.Route = &definitions.Route{
			Receiver: "a new receiver",
		}
		cfg.AlertmanagerConfig.Receivers = []*definitions.PostableApiReceiver{
			{
				Receiver: config.Receiver{
					Name: "a new receiver",
				},
			},
			// No default receiver! Only our custom one.
		}
		data, _ := serializeAlertmanagerConfig(*cfg)
		sut.amStore.(*MockAMConfigStore).On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		var interceptedSave = models.SaveAlertmanagerConfigurationCmd{}
		sut.amStore.(*MockAMConfigStore).EXPECT().SaveSucceedsIntercept(&interceptedSave)

		tree, err := sut.ResetPolicyTree(context.Background(), 1)

		require.NoError(t, err)
		require.Equal(t, "grafana-default-email", tree.Receiver)
		require.NotEmpty(t, interceptedSave.AlertmanagerConfiguration)
		// Deserializing with no error asserts that the saved config is semantically valid.
		newCfg, err := deserializeAlertmanagerConfig([]byte(interceptedSave.AlertmanagerConfiguration))
		require.NoError(t, err)
		require.Len(t, newCfg.AlertmanagerConfig.Receivers, 2)
	})
}

func createNotificationPolicyServiceSut() *NotificationPolicyService {
	return &NotificationPolicyService{
		amStore:         newFakeAMConfigStore(),
		provenanceStore: NewFakeProvisioningStore(),
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
		settings: setting.UnifiedAlertingSettings{
			DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
		},
	}
}

func createTestRoutingTree() definitions.Route {
	return definitions.Route{
		Receiver: "a new receiver",
	}
}

func createTestAlertingConfig() *definitions.PostableUserConfig {
	cfg, _ := deserializeAlertmanagerConfig([]byte(defaultConfig))
	cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers,
		&definitions.PostableApiReceiver{
			Receiver: config.Receiver{
				// default one from createTestRoutingTree()
				Name: "a new receiver",
			},
		})
	cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers,
		&definitions.PostableApiReceiver{
			Receiver: config.Receiver{
				Name: "existing",
			},
		})
	return cfg
}

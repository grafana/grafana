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
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
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
		mockStore := &legacy_storage.MockAMConfigStore{}
		sut.configStore = legacy_storage.NewAlertmanagerConfigStore(mockStore)
		cfg := createTestAlertingConfig()
		cfg.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{
			{
				Name:          "not-the-one-we-need",
				TimeIntervals: []timeinterval.TimeInterval{},
			},
		}
		data, _ := legacy_storage.SerializeAlertmanagerConfig(*cfg)
		mockStore.On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		mockStore.EXPECT().
			UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Return(nil)
		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver:          "slack receiver",
			MuteTimeIntervals: []string{"not-existing"},
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.Error(t, err)
	})

	t.Run("pass if referenced mute time interval is existing", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()
		mockStore := &legacy_storage.MockAMConfigStore{}
		sut.configStore = legacy_storage.NewAlertmanagerConfigStore(mockStore)
		cfg := createTestAlertingConfig()
		cfg.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{
			{
				Name:          "existing",
				TimeIntervals: []timeinterval.TimeInterval{},
			},
		}
		data, _ := legacy_storage.SerializeAlertmanagerConfig(*cfg)
		mockStore.On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		mockStore.EXPECT().
			UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Return(nil)
		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver:          "slack receiver",
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
		require.Equal(t, "slack receiver", updated.Receiver)
	})

	t.Run("no root receiver will error", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		newRoute := createTestRoutingTree()
		newRoute.Receiver = ""
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver: "",
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.EqualError(t, err, "invalid object specification: root route must specify a default receiver")
	})

	t.Run("allow receiver inheritance", func(t *testing.T) {
		sut := createNotificationPolicyServiceSut()

		newRoute := createTestRoutingTree()
		newRoute.Routes = append(newRoute.Routes, &definitions.Route{
			Receiver: "",
		})

		err := sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceNone)
		require.NoError(t, err)
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
		mockStore := &legacy_storage.MockAMConfigStore{}
		sut.configStore = legacy_storage.NewAlertmanagerConfigStore(mockStore)
		cfg := createTestAlertingConfig()
		data, _ := legacy_storage.SerializeAlertmanagerConfig(*cfg)
		mockStore.On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		mockStore.EXPECT().
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
		fake := fakes.NewFakeAlertmanagerConfigStore(defaultAlertmanagerConfigJSON)
		sut.configStore = legacy_storage.NewAlertmanagerConfigStore(fake)
		newRoute := createTestRoutingTree()
		config, err := sut.configStore.Get(context.Background(), 1)
		require.NoError(t, err)
		expectedConcurrencyToken := config.ConcurrencyToken

		err = sut.UpdatePolicyTree(context.Background(), 1, newRoute, models.ProvenanceAPI)
		require.NoError(t, err)

		intercepted := fake.LastSaveCommand
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
		mockStore := &legacy_storage.MockAMConfigStore{}
		sut.configStore = legacy_storage.NewAlertmanagerConfigStore(mockStore)
		cfg := createTestAlertingConfig()
		cfg.AlertmanagerConfig.Route = &definitions.Route{
			Receiver: "slack receiver",
		}
		cfg.AlertmanagerConfig.Receivers = []*definitions.PostableApiReceiver{
			{
				Receiver: config.Receiver{
					Name: "slack receiver",
				},
			},
			// No default receiver! Only our custom one.
		}
		data, _ := legacy_storage.SerializeAlertmanagerConfig(*cfg)
		mockStore.On("GetLatestAlertmanagerConfiguration", mock.Anything, mock.Anything).
			Return(&models.AlertConfiguration{AlertmanagerConfiguration: string(data)}, nil)
		var interceptedSave = models.SaveAlertmanagerConfigurationCmd{}
		mockStore.EXPECT().SaveSucceedsIntercept(&interceptedSave)

		tree, err := sut.ResetPolicyTree(context.Background(), 1)

		require.NoError(t, err)
		require.Equal(t, "grafana-default-email", tree.Receiver)
		require.NotEmpty(t, interceptedSave.AlertmanagerConfiguration)
		// Deserializing with no error asserts that the saved configStore is semantically valid.
		newCfg, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(interceptedSave.AlertmanagerConfiguration))
		require.NoError(t, err)
		require.Len(t, newCfg.AlertmanagerConfig.Receivers, 2)
	})
}

func createNotificationPolicyServiceSut() *NotificationPolicyService {
	return &NotificationPolicyService{
		configStore:     legacy_storage.NewAlertmanagerConfigStore(fakes.NewFakeAlertmanagerConfigStore(defaultAlertmanagerConfigJSON)),
		provenanceStore: fakes.NewFakeProvisioningStore(),
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
		settings: setting.UnifiedAlertingSettings{
			DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
		},
	}
}

func createTestRoutingTree() definitions.Route {
	return definitions.Route{
		Receiver: "slack receiver",
	}
}

func createTestAlertingConfig() *definitions.PostableUserConfig {
	cfg, _ := legacy_storage.DeserializeAlertmanagerConfig([]byte(defaultConfig))
	cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers,
		&definitions.PostableApiReceiver{
			Receiver: config.Receiver{
				// default one from createTestRoutingTree()
				Name: "slack receiver",
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

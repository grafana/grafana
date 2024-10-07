package provisioning

import (
	"context"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestGetPolicyTree(t *testing.T) {
	orgID := int64(1)
	rev := getDefaultConfigRevision()
	expectedVersion := calculateRouteFingerprint(*rev.Config.AlertmanagerConfig.Route)

	sut, store, prov := createNotificationPolicyServiceSut()
	store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
		return &rev, nil
	}
	expectedProvenance := models.ProvenanceAPI
	prov.GetProvenanceFunc = func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
		return models.ProvenanceAPI, nil
	}

	tree, version, err := sut.GetPolicyTree(context.Background(), orgID)
	require.NoError(t, err)

	expectedRoute := *rev.Config.AlertmanagerConfig.Route
	expectedRoute.Provenance = definitions.Provenance(models.ProvenanceAPI)
	assert.Equal(t, expectedRoute, tree)
	assert.Equal(t, expectedVersion, version)
	assert.Equal(t, expectedProvenance, models.Provenance(tree.Provenance))

	assert.Len(t, store.Calls, 1)
	assert.Equal(t, "Get", store.Calls[0].Method)
	assert.Equal(t, orgID, store.Calls[0].Args[1])

	assert.Len(t, prov.Calls, 1)
	assert.Equal(t, "GetProvenance", prov.Calls[0].MethodName)
	assert.IsType(t, &definitions.Route{}, prov.Calls[0].Arguments[1])
	assert.Equal(t, orgID, prov.Calls[0].Arguments[2])
}

func TestUpdatePolicyTree(t *testing.T) {
	orgID := int64(1)
	rev := getDefaultConfigRevision()

	defaultVersion := calculateRouteFingerprint(*rev.Config.AlertmanagerConfig.Route)

	newRoute := definitions.Route{
		Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		Routes: []*definitions.Route{
			{
				Receiver: "",
				MuteTimeIntervals: []string{
					rev.Config.AlertmanagerConfig.TimeIntervals[0].Name,
				},
			},
			{
				Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			},
		},
	}

	t.Run("ErrValidation if referenced mute time interval does not exist", func(t *testing.T) {
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			MuteTimeIntervals: []string{
				"not-existing",
			},
		}
		err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("ErrValidation if root route has no receiver", func(t *testing.T) {
		rev := getDefaultConfigRevision()
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: "",
		}
		err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("ErrValidation if referenced receiver does not exist", func(t *testing.T) {
		rev := getDefaultConfigRevision()
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: "unknown",
		}
		err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, ErrValidation)

		t.Run("including sub-routes", func(t *testing.T) {
			newRoute := definitions.Route{
				Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
				Routes: []*definitions.Route{
					{Receiver: "unknown"},
				},
			}
			err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
			require.ErrorIs(t, err, ErrValidation)
		})
	})

	t.Run("ErrVersionConflict if provided version does not match current", func(t *testing.T) {
		rev := getDefaultConfigRevision()
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		}
		err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, "wrong-version")
		require.ErrorIs(t, err, ErrVersionConflict)
	})

	t.Run("updates Route and sets provenance in transaction if route is valid and version matches", func(t *testing.T) {
		sut, store, prov := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		expectedRev := getDefaultConfigRevision()
		route := newRoute
		expectedRev.ConcurrencyToken = rev.ConcurrencyToken
		expectedRev.Config.AlertmanagerConfig.Route = &route

		err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceAPI, defaultVersion)
		require.NoError(t, err)

		assert.Len(t, store.Calls, 2)
		assert.Equal(t, "Save", store.Calls[1].Method)
		assertInTransaction(t, store.Calls[1].Args[0].(context.Context))
		assert.Equal(t, &expectedRev, store.Calls[1].Args[1])

		assert.Len(t, prov.Calls, 1)
		assert.Equal(t, "SetProvenance", prov.Calls[0].MethodName)
		assertInTransaction(t, prov.Calls[0].Arguments[0].(context.Context))
		assert.IsType(t, &definitions.Route{}, prov.Calls[0].Arguments[1])
		assert.Equal(t, orgID, prov.Calls[0].Arguments[2].(int64))
		assert.Equal(t, models.ProvenanceAPI, prov.Calls[0].Arguments[3].(models.Provenance))
	})

	t.Run("bypasses optimistic concurrency if provided version is empty", func(t *testing.T) {
		sut, store, prov := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}

		expectedRev := getDefaultConfigRevision()
		expectedRev.Config.AlertmanagerConfig.Route = &newRoute
		expectedRev.ConcurrencyToken = rev.ConcurrencyToken

		err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceAPI, "")
		require.NoError(t, err)

		assert.Len(t, store.Calls, 2)
		assert.Equal(t, "Save", store.Calls[1].Method)
		assertInTransaction(t, store.Calls[1].Args[0].(context.Context))
		assert.Equal(t, &expectedRev, store.Calls[1].Args[1])

		assert.Len(t, prov.Calls, 1)
		assert.Equal(t, "SetProvenance", prov.Calls[0].MethodName)
		assertInTransaction(t, prov.Calls[0].Arguments[0].(context.Context))
		assert.IsType(t, &definitions.Route{}, prov.Calls[0].Arguments[1])
		assert.Equal(t, orgID, prov.Calls[0].Arguments[2].(int64))
		assert.Equal(t, models.ProvenanceAPI, prov.Calls[0].Arguments[3].(models.Provenance))
	})
}

func TestResetPolicyTree(t *testing.T) {
	orgID := int64(1)

	currentRevision := getDefaultConfigRevision()
	currentRevision.Config.AlertmanagerConfig.Route = &definitions.Route{
		Receiver: "receiver",
	}
	currentRevision.Config.TemplateFiles = map[string]string{
		"test": "test",
	}
	currentRevision.Config.AlertmanagerConfig.TimeIntervals = []config.TimeInterval{
		{
			Name: "test",
		},
	}
	currentRevision.Config.AlertmanagerConfig.Receivers = []*definitions.PostableApiReceiver{
		{
			Receiver: config.Receiver{Name: "receiver"},
			PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
					{
						UID: "test", Name: "test", Type: "email", Settings: []byte("{}"),
					},
				},
			},
		},
	}

	t.Run("Error if default config is invalid", func(t *testing.T) {
		sut, _, _ := createNotificationPolicyServiceSut()
		sut.settings = setting.UnifiedAlertingSettings{
			DefaultConfiguration: "{",
		}
		_, err := sut.ResetPolicyTree(context.Background(), orgID)
		require.ErrorContains(t, err, "failed to parse default alertmanager config")
	})

	t.Run("replaces route with one from the default config and copies receivers if do not exist", func(t *testing.T) {
		defaultConfig := getDefaultConfigRevision().Config
		data, err := legacy_storage.SerializeAlertmanagerConfig(*defaultConfig)
		require.NoError(t, err)

		sut, store, prov := createNotificationPolicyServiceSut()
		sut.settings = setting.UnifiedAlertingSettings{
			DefaultConfiguration: string(data),
		}

		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			data, err := legacy_storage.SerializeAlertmanagerConfig(*currentRevision.Config)
			require.NoError(t, err)
			cfg, err := legacy_storage.DeserializeAlertmanagerConfig(data)
			require.NoError(t, err)
			return &legacy_storage.ConfigRevision{
				Config:           cfg,
				ConcurrencyToken: util.GenerateShortUID(),
			}, nil
		}

		expectedRev := currentRevision
		expectedRev.Config.AlertmanagerConfig.Route = getDefaultConfigRevision().Config.AlertmanagerConfig.Route
		expectedRev.Config.AlertmanagerConfig.Receivers = append(expectedRev.Config.AlertmanagerConfig.Receivers, getDefaultConfigRevision().Config.AlertmanagerConfig.Receivers[0])

		tree, err := sut.ResetPolicyTree(context.Background(), orgID)
		require.NoError(t, err)
		assert.Equal(t, *defaultConfig.AlertmanagerConfig.Route, tree)

		assert.Len(t, store.Calls, 2)
		assert.Equal(t, "Save", store.Calls[1].Method)
		assertInTransaction(t, store.Calls[1].Args[0].(context.Context))
		resetRev := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, expectedRev.Config.AlertmanagerConfig, resetRev.Config.AlertmanagerConfig)

		assert.Len(t, prov.Calls, 1)
		assert.Equal(t, "DeleteProvenance", prov.Calls[0].MethodName)
		assertInTransaction(t, prov.Calls[0].Arguments[0].(context.Context))
		assert.IsType(t, &definitions.Route{}, prov.Calls[0].Arguments[1])
		assert.Equal(t, orgID, prov.Calls[0].Arguments[2])
	})
}

func createNotificationPolicyServiceSut() (*NotificationPolicyService, *legacy_storage.AlertmanagerConfigStoreFake, *fakes.FakeProvisioningStore) {
	prov := fakes.NewFakeProvisioningStore()
	configStore := &legacy_storage.AlertmanagerConfigStoreFake{
		GetFn: func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			rev := getDefaultConfigRevision()
			return &rev, nil
		},
	}
	return &NotificationPolicyService{
		configStore:     configStore,
		provenanceStore: prov,
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
		settings: setting.UnifiedAlertingSettings{
			DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
		},
	}, configStore, prov
}

func getDefaultConfigRevision() legacy_storage.ConfigRevision {
	return legacy_storage.ConfigRevision{
		Config: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definition.Config{
					Route: &definitions.Route{
						Receiver: "test-receiver",
					},
					InhibitRules: nil,
					TimeIntervals: []config.TimeInterval{
						{
							Name: "test-mute-interval",
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "test-receiver",
						},
					},
				},
			},
		},
		ConcurrencyToken: util.GenerateShortUID(),
	}
}

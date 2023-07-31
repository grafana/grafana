package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/alertmanager/config"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestMuteTimingService(t *testing.T) {
	t.Run("service returns timings from config file", func(t *testing.T) {
		sut := createMuteTimingSvcSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetsConfig(models.AlertConfiguration{
				AlertmanagerConfiguration: configWithMuteTimings,
			})

		result, err := sut.GetMuteTimings(context.Background(), 1)

		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Equal(t, "asdf", result[0].Name)
	})

	t.Run("service returns empty list when config file contains no mute timings", func(t *testing.T) {
		sut := createMuteTimingSvcSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetsConfig(models.AlertConfiguration{
				AlertmanagerConfiguration: defaultConfig,
			})

		result, err := sut.GetMuteTimings(context.Background(), 1)

		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
				Return(nil, fmt.Errorf("failed"))

			_, err := sut.GetMuteTimings(context.Background(), 1)

			require.Error(t, err)
		})

		t.Run("when config is invalid", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: brokenConfig,
				})

			_, err := sut.GetMuteTimings(context.Background(), 1)

			require.ErrorContains(t, err, "failed to deserialize")
		})

		t.Run("when no AM config in current org", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
				Return(nil, nil)

			_, err := sut.GetMuteTimings(context.Background(), 1)

			require.ErrorContains(t, err, "no alertmanager configuration")
		})
	})

	t.Run("creating mute timings", func(t *testing.T) {
		t.Run("rejects mute timings that fail validation", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			timing := definitions.MuteTimeInterval{
				MuteTimeInterval: config.MuteTimeInterval{
					Name: "",
				},
			}

			_, err := sut.CreateMuteTiming(context.Background(), timing, 1)

			require.ErrorIs(t, err, ErrValidation)
		})

		t.Run("propagates errors", func(t *testing.T) {
			t.Run("when unable to read config", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("failed"))

				_, err := sut.CreateMuteTiming(context.Background(), timing, 1)

				require.Error(t, err)
			})

			t.Run("when config is invalid", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: brokenConfig,
					})

				_, err := sut.CreateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "failed to deserialize")
			})

			t.Run("when no AM config in current org", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil, nil)

				_, err := sut.CreateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "no alertmanager configuration")
			})

			t.Run("when provenance fails to save", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimings,
					})
				sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
				sut.prov.(*MockProvisioningStore).EXPECT().
					SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save provenance"))

				_, err := sut.CreateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "failed to save provenance")
			})

			t.Run("when AM config fails to save", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimings,
					})
				sut.config.(*MockAMConfigStore).EXPECT().
					UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save config"))
				sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

				_, err := sut.CreateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "failed to save config")
			})
		})
	})

	t.Run("updating mute timings", func(t *testing.T) {
		t.Run("rejects mute timings that fail validation", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			timing := definitions.MuteTimeInterval{
				MuteTimeInterval: config.MuteTimeInterval{
					Name: "",
				},
			}

			_, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

			require.ErrorIs(t, err, ErrValidation)
		})

		t.Run("returns nil if timing does not exist", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			timing := createMuteTiming()
			timing.Name = "does not exist"
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: configWithMuteTimings,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			updated, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

			require.NoError(t, err)
			require.Nil(t, updated)
		})

		t.Run("propagates errors", func(t *testing.T) {
			t.Run("when unable to read config", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				timing.Name = "asdf"
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("failed"))

				_, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

				require.Error(t, err)
			})

			t.Run("when config is invalid", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				timing.Name = "asdf"
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: brokenConfig,
					})

				_, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "failed to deserialize")
			})

			t.Run("when no AM config in current org", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				timing.Name = "asdf"
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil, nil)

				_, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "no alertmanager configuration")
			})

			t.Run("when provenance fails to save", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				timing.Name = "asdf"
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimings,
					})
				sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
				sut.prov.(*MockProvisioningStore).EXPECT().
					SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save provenance"))

				_, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "failed to save provenance")
			})

			t.Run("when AM config fails to save", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				timing := createMuteTiming()
				timing.Name = "asdf"
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimings,
					})
				sut.config.(*MockAMConfigStore).EXPECT().
					UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save config"))
				sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

				_, err := sut.UpdateMuteTiming(context.Background(), timing, 1)

				require.ErrorContains(t, err, "failed to save config")
			})
		})
	})

	t.Run("deleting mute timings", func(t *testing.T) {
		t.Run("returns nil if timing does not exist", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: configWithMuteTimings,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			err := sut.DeleteMuteTiming(context.Background(), "does not exist", 1)

			require.NoError(t, err)
		})

		t.Run("propagates errors", func(t *testing.T) {
			t.Run("when unable to read config", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("failed"))

				err := sut.DeleteMuteTiming(context.Background(), "asdf", 1)

				require.Error(t, err)
			})

			t.Run("when config is invalid", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: brokenConfig,
					})

				err := sut.DeleteMuteTiming(context.Background(), "asdf", 1)

				require.ErrorContains(t, err, "failed to deserialize")
			})

			t.Run("when no AM config in current org", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil, nil)

				err := sut.DeleteMuteTiming(context.Background(), "asdf", 1)

				require.ErrorContains(t, err, "no alertmanager configuration")
			})

			t.Run("when provenance fails to save", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimings,
					})
				sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
				sut.prov.(*MockProvisioningStore).EXPECT().
					DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save provenance"))

				err := sut.DeleteMuteTiming(context.Background(), "asdf", 1)

				require.ErrorContains(t, err, "failed to save provenance")
			})

			t.Run("when AM config fails to save", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimings,
					})
				sut.config.(*MockAMConfigStore).EXPECT().
					UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save config"))
				sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

				err := sut.DeleteMuteTiming(context.Background(), "asdf", 1)

				require.ErrorContains(t, err, "failed to save config")
			})

			t.Run("when mute timing is used in route", func(t *testing.T) {
				sut := createMuteTimingSvcSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithMuteTimingsInRoute,
					})

				err := sut.DeleteMuteTiming(context.Background(), "asdf", 1)

				require.Error(t, err)
			})
		})
	})
}

func createMuteTimingSvcSut() *MuteTimingService {
	return &MuteTimingService{
		config: &MockAMConfigStore{},
		prov:   &MockProvisioningStore{},
		xact:   newNopTransactionManager(),
		log:    log.NewNopLogger(),
	}
}

func createMuteTiming() definitions.MuteTimeInterval {
	return definitions.MuteTimeInterval{
		MuteTimeInterval: config.MuteTimeInterval{
			Name: "interval",
		},
	}
}

var configWithMuteTimings = `
{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"mute_time_intervals": [{
			"name": "asdf",
			"time_intervals": [{
				"times": [],
				"weekdays": ["monday"]
			}]
		}],
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}]
	}
}
`

var configWithMuteTimingsInRoute = `
{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email",
			"routes": [
				{
					"receiver": "grafana-default-email",
					"mute_time_intervals": ["asdf"]
				}
			]
		},
		"mute_time_intervals": [{
			"name": "asdf",
			"time_intervals": [{
				"times": [],
				"weekdays": ["monday"]
			}]
		}],
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}]
	}
}
`

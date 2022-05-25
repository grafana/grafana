package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestMuteTimingService(t *testing.T) {
	t.Run("service returns timings from config file", func(t *testing.T) {
		sut := createMuteTimingSvcSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			getsConfig(models.AlertConfiguration{
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
			getsConfig(models.AlertConfiguration{
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
				Return(fmt.Errorf("failed"))

			_, err := sut.GetMuteTimings(context.Background(), 1)

			require.Error(t, err)
		})

		t.Run("when config is invalid", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				getsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: brokenConfig,
				})

			_, err := sut.GetMuteTimings(context.Background(), 1)

			require.ErrorContains(t, err, "failed to deserialize")
		})

		t.Run("when no AM config in current org", func(t *testing.T) {
			sut := createMuteTimingSvcSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
				Return(nil)

			_, err := sut.GetMuteTimings(context.Background(), 1)

			require.ErrorContains(t, err, "no alertmanager configuration")
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

package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestTemplateService(t *testing.T) {
	t.Run("service returns templates from config file", func(t *testing.T) {
		sut := createTemplateServiceSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Run(func(ctx context.Context, q *models.GetLatestAlertmanagerConfigurationQuery) {
				q.Result = &models.AlertConfiguration{
					AlertmanagerConfiguration: configWithTemplates,
				}
			}).
			Return(nil)

		result, err := sut.GetTemplates(context.Background(), 1)

		require.NoError(t, err)
		require.Len(t, result, 1)
	})

	t.Run("service returns empty map when config file contains no templates", func(t *testing.T) {
		sut := createTemplateServiceSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
			Run(func(ctx context.Context, q *models.GetLatestAlertmanagerConfigurationQuery) {
				q.Result = &models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				}
			}).
			Return(nil)

		result, err := sut.GetTemplates(context.Background(), 1)

		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut := createTemplateServiceSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
				Return(fmt.Errorf("failed"))

			_, err := sut.GetTemplates(context.Background(), 1)

			require.Error(t, err)
		})

		t.Run("when config is invalid", func(t *testing.T) {
			sut := createTemplateServiceSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
				Run(func(ctx context.Context, q *models.GetLatestAlertmanagerConfigurationQuery) {
					q.Result = &models.AlertConfiguration{
						AlertmanagerConfiguration: brokenConfig,
					}
				}).
				Return(nil)

			_, err := sut.GetTemplates(context.Background(), 1)

			require.ErrorContains(t, err, "failed to deserialize")
		})

		t.Run("when no AM config in current org", func(t *testing.T) {
			sut := createTemplateServiceSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
				Return(nil)

			_, err := sut.GetTemplates(context.Background(), 1)

			require.ErrorContains(t, err, "no alertmanager configuration")
		})
	})
}

func createTemplateServiceSut() *TemplateService {
	return &TemplateService{
		config: &MockAMConfigStore{},
		prov:   newFakeProvisioningStore(),
		xact:   newNopTransactionManager(),
		log:    log.NewNopLogger(),
	}
}

var defaultConfig = setting.GetAlertmanagerDefaultConfiguration()

var configWithTemplates = `
{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
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

var brokenConfig = `
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "abc",
				"name": "default-email",
				"type": "email",
				"isDefault": true,
				"settings": {}
			}]
		}]
	}
}`

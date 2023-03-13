package provisioning

import (
	"context"
	"fmt"
	"testing"

	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestTemplateService(t *testing.T) {
	t.Run("service returns templates from config file", func(t *testing.T) {
		sut := createTemplateServiceSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetsConfig(models.AlertConfiguration{
				AlertmanagerConfiguration: configWithTemplates,
			})

		result, err := sut.GetTemplates(context.Background(), 1)

		require.NoError(t, err)
		require.Len(t, result, 1)
	})

	t.Run("service returns empty map when config file contains no templates", func(t *testing.T) {
		sut := createTemplateServiceSut()
		sut.config.(*MockAMConfigStore).EXPECT().
			GetsConfig(models.AlertConfiguration{
				AlertmanagerConfiguration: defaultConfig,
			})

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
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: brokenConfig,
				})

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

	t.Run("setting templates", func(t *testing.T) {
		t.Run("rejects templates that fail validation", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := definitions.NotificationTemplate{
				Name:     "",
				Template: "",
			}

			_, err := sut.SetTemplate(context.Background(), 1, tmpl)

			require.ErrorIs(t, err, ErrValidation)
		})

		t.Run("propagates errors", func(t *testing.T) {
			t.Run("when unable to read config", func(t *testing.T) {
				sut := createTemplateServiceSut()
				tmpl := createNotificationTemplate()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed"))

				_, err := sut.SetTemplate(context.Background(), 1, tmpl)

				require.Error(t, err)
			})

			t.Run("when config is invalid", func(t *testing.T) {
				sut := createTemplateServiceSut()
				tmpl := createNotificationTemplate()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: brokenConfig,
					})

				_, err := sut.SetTemplate(context.Background(), 1, tmpl)

				require.ErrorContains(t, err, "failed to deserialize")
			})

			t.Run("when no AM config in current org", func(t *testing.T) {
				sut := createTemplateServiceSut()
				tmpl := createNotificationTemplate()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil)

				_, err := sut.SetTemplate(context.Background(), 1, tmpl)

				require.ErrorContains(t, err, "no alertmanager configuration")
			})

			t.Run("when provenance fails to save", func(t *testing.T) {
				sut := createTemplateServiceSut()
				tmpl := createNotificationTemplate()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithTemplates,
					})
				sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
				sut.prov.(*MockProvisioningStore).EXPECT().
					SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save provenance"))

				_, err := sut.SetTemplate(context.Background(), 1, tmpl)

				require.ErrorContains(t, err, "failed to save provenance")
			})

			t.Run("when AM config fails to save", func(t *testing.T) {
				sut := createTemplateServiceSut()
				tmpl := createNotificationTemplate()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithTemplates,
					})
				sut.config.(*MockAMConfigStore).EXPECT().
					UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save config"))
				sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

				_, err := sut.SetTemplate(context.Background(), 1, tmpl)

				require.ErrorContains(t, err, "failed to save config")
			})
		})

		t.Run("adds new template to config file on success", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := createNotificationTemplate()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: configWithTemplates,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			_, err := sut.SetTemplate(context.Background(), 1, tmpl)

			require.NoError(t, err)
		})

		t.Run("succeeds when stitching config file with no templates", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := createNotificationTemplate()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			_, err := sut.SetTemplate(context.Background(), 1, tmpl)

			require.NoError(t, err)
		})

		t.Run("normalizes template content with no define", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := definitions.NotificationTemplate{
				Name:     "name",
				Template: "content",
			}
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			result, _ := sut.SetTemplate(context.Background(), 1, tmpl)

			exp := "{{ define \"name\" }}\n  content\n{{ end }}"
			require.Equal(t, exp, result.Template)
		})

		t.Run("avoids normalizing template content with define", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := definitions.NotificationTemplate{
				Name:     "name",
				Template: "{{define \"name\"}}content{{end}}",
			}
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			result, _ := sut.SetTemplate(context.Background(), 1, tmpl)

			require.Equal(t, tmpl.Template, result.Template)
		})

		t.Run("rejects syntactically invalid template", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := definitions.NotificationTemplate{
				Name:     "name",
				Template: "{{ .MyField }",
			}
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			_, err := sut.SetTemplate(context.Background(), 1, tmpl)

			require.ErrorIs(t, err, ErrValidation)
		})

		t.Run("does not reject template with unknown field", func(t *testing.T) {
			sut := createTemplateServiceSut()
			tmpl := definitions.NotificationTemplate{
				Name:     "name",
				Template: "{{ .NotAField }}",
			}
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			_, err := sut.SetTemplate(context.Background(), 1, tmpl)

			require.NoError(t, err)
		})
	})

	t.Run("deleting templates", func(t *testing.T) {
		t.Run("propagates errors", func(t *testing.T) {
			t.Run("when unable to read config", func(t *testing.T) {
				sut := createTemplateServiceSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed"))

				err := sut.DeleteTemplate(context.Background(), 1, "template")

				require.Error(t, err)
			})

			t.Run("when config is invalid", func(t *testing.T) {
				sut := createTemplateServiceSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: brokenConfig,
					})

				err := sut.DeleteTemplate(context.Background(), 1, "template")

				require.ErrorContains(t, err, "failed to deserialize")
			})

			t.Run("when no AM config in current org", func(t *testing.T) {
				sut := createTemplateServiceSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(nil)

				err := sut.DeleteTemplate(context.Background(), 1, "template")

				require.ErrorContains(t, err, "no alertmanager configuration")
			})

			t.Run("when provenance fails to save", func(t *testing.T) {
				sut := createTemplateServiceSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithTemplates,
					})
				sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
				sut.prov.(*MockProvisioningStore).EXPECT().
					DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save provenance"))

				err := sut.DeleteTemplate(context.Background(), 1, "template")

				require.ErrorContains(t, err, "failed to save provenance")
			})

			t.Run("when AM config fails to save", func(t *testing.T) {
				sut := createTemplateServiceSut()
				sut.config.(*MockAMConfigStore).EXPECT().
					GetsConfig(models.AlertConfiguration{
						AlertmanagerConfiguration: configWithTemplates,
					})
				sut.config.(*MockAMConfigStore).EXPECT().
					UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to save config"))
				sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

				err := sut.DeleteTemplate(context.Background(), 1, "template")

				require.ErrorContains(t, err, "failed to save config")
			})
		})

		t.Run("deletes template from config file on success", func(t *testing.T) {
			sut := createTemplateServiceSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: configWithTemplates,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			err := sut.DeleteTemplate(context.Background(), 1, "a")

			require.NoError(t, err)
		})

		t.Run("does not error when deleting templates that do not exist", func(t *testing.T) {
			sut := createTemplateServiceSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: configWithTemplates,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			err := sut.DeleteTemplate(context.Background(), 1, "does not exist")

			require.NoError(t, err)
		})

		t.Run("succeeds when deleting from config file with no template section", func(t *testing.T) {
			sut := createTemplateServiceSut()
			sut.config.(*MockAMConfigStore).EXPECT().
				GetsConfig(models.AlertConfiguration{
					AlertmanagerConfiguration: defaultConfig,
				})
			sut.config.(*MockAMConfigStore).EXPECT().SaveSucceeds()
			sut.prov.(*MockProvisioningStore).EXPECT().SaveSucceeds()

			err := sut.DeleteTemplate(context.Background(), 1, "a")

			require.NoError(t, err)
		})
	})
}

func createTemplateServiceSut() *TemplateService {
	return &TemplateService{
		config: &MockAMConfigStore{},
		prov:   &MockProvisioningStore{},
		xact:   newNopTransactionManager(),
		log:    log.NewNopLogger(),
	}
}

func createNotificationTemplate() definitions.NotificationTemplate {
	return definitions.NotificationTemplate{
		Name:     "test",
		Template: "asdf",
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

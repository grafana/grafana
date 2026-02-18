package notifier

import (
	"context"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestMultiOrgAlertmanager_SaveAndApplyExtraConfiguration(t *testing.T) {
	orgID := int64(1)

	t.Run("fails when organization does not exist", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := definitions.ExtraConfiguration{
			Identifier: "test-config",
			AlertmanagerConfig: `route:
  receiver: test-receiver`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, 999, extraConfig, false, false)
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to get current configuration")
	})

	t.Run("save new extra configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := definitions.ExtraConfiguration{
			Identifier:    "test-alertmanager-config",
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
			TemplateFiles: map[string]string{"test.tmpl": "{{ define \"test\" }}Test{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}

		renamed, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, extraConfig, false, false)
		require.NoError(t, err)
		require.Empty(t, renamed.Receivers, "no renaming should occur")
		require.Empty(t, renamed.TimeIntervals, "no renaming should occur")

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)
		require.Equal(t, extraConfig.Identifier, gettableConfig.ExtraConfigs[0].Identifier)
		require.Equal(t, extraConfig.TemplateFiles, gettableConfig.ExtraConfigs[0].TemplateFiles)

		// Test that we can get the alertmanager config from raw storage
		// We need to pass a decrypt function since the config is now encrypted
		amConfig, err := gettableConfig.ExtraConfigs[0].GetAlertmanagerConfig()
		require.NoError(t, err)
		require.Equal(t, "test-receiver", amConfig.Route.Receiver)
		require.Len(t, amConfig.Receivers, 1)
		require.Equal(t, "test-receiver", amConfig.Receivers[0].Name)
	})

	t.Run("dry run validates configuration without saving", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := definitions.ExtraConfiguration{
			Identifier:    "dry-run-config",
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "test"}},
			TemplateFiles: map[string]string{"test.tmpl": "{{ define \"test\" }}Test{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}

		// Call with dryRun=true
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, extraConfig, false, true)
		require.NoError(t, err)

		// Verify configuration was NOT saved
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0, "configuration should not be saved in dry run mode")
	})

	t.Run("replace existing extra configuration with same identifier", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-config"

		// First add a configuration
		originalConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "original"}},
			AlertmanagerConfig: `route:
  receiver: original-receiver
receivers:
  - name: original-receiver`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, originalConfig, false, false)
		require.NoError(t, err)

		// Now replace it
		updatedConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "updated"}},
			TemplateFiles: map[string]string{"updated.tmpl": "{{ define \"updated\" }}Updated{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: updated-receiver
receivers:
  - name: updated-receiver`,
		}

		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, updatedConfig, false, false)
		require.NoError(t, err)

		// Verify only one config exists with updated content
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)
		require.Equal(t, identifier, gettableConfig.ExtraConfigs[0].Identifier)
		require.Contains(t, gettableConfig.ExtraConfigs[0].TemplateFiles, "updated.tmpl")
	})

	t.Run("fail to create multiple extra configurations", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		firstConfig := definitions.ExtraConfiguration{
			Identifier:    "first-config",
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "first"}},
			AlertmanagerConfig: `{
				"route": {
					"receiver": "first-receiver"
				},
				"receivers": [
					{
						"name": "first-receiver"
					}
				]
			}`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, firstConfig, false, false)
		require.NoError(t, err)

		secondConfig := definitions.ExtraConfiguration{
			Identifier:    "second-config",
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "second"}},
			AlertmanagerConfig: `{
				"route": {
					"receiver": "second-receiver"
				},
				"receivers": [
					{
						"name": "second-receiver"
					}
				]
			}`,
		}

		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, secondConfig, false, false)
		require.Error(t, err)
		require.ErrorContains(t, err, "multiple extra configurations are not supported")
		require.ErrorContains(t, err, "first-config")

		t.Run("replaces if replace=true", func(t *testing.T) {
			_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, secondConfig, true, false)
			require.NoError(t, err)

			gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
			require.NoError(t, err)
			require.Len(t, gettableConfig.ExtraConfigs, 1)
			require.Equal(t, secondConfig.Identifier, gettableConfig.ExtraConfigs[0].Identifier)
		})
	})

	t.Run("fail to create extra configuration with identifier that used in managed routes", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-config"

		require.NoError(t, mam.SaveAndApplyAlertmanagerConfiguration(ctx, orgID, definitions.PostableUserConfig{
			ManagedRoutes: map[string]*definitions.Route{
				identifier: {Receiver: "initial-receiver"},
			},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "initial-receiver",
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "initial-receiver",
						},
					},
				},
			},
		}))

		originalConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "original"}},
			AlertmanagerConfig: `route:
  receiver: original-receiver
receivers:
  - name: original-receiver`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, originalConfig, false, false)
		require.ErrorIs(t, err, ErrIdentifierAlreadyExists)
	})
}

func TestMultiOrgAlertmanager_SaveAndApplyAlertmanagerConfiguration(t *testing.T) {
	orgID := int64(1)
	ctx := context.Background()

	t.Run("SaveAndApplyAlertmanagerConfiguration preserves existing extra configs", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := definitions.ExtraConfiguration{
			Identifier:    "test-extra-config",
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "test"}},
			TemplateFiles: map[string]string{"test.tmpl": "{{ define \"test\" }}Test{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: extra-receiver
receivers:
  - name: extra-receiver`,
		}

		renamed, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, extraConfig, false, false)
		require.NoError(t, err)
		require.Empty(t, renamed.Receivers, "no renaming should occur")
		require.Empty(t, renamed.TimeIntervals, "no renaming should occur")

		// Verify extra config was saved
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)
		require.Equal(t, extraConfig.Identifier, gettableConfig.ExtraConfigs[0].Identifier)

		// Apply a new main configuration
		newMainConfig := definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "main-receiver",
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "main-receiver",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									Name:     "main-receiver",
									Type:     "email",
									Settings: definitions.RawMessage(`{"addresses": "me@grafana.com"}`),
								},
							},
						},
					},
				},
			},
		}

		err = mam.SaveAndApplyAlertmanagerConfiguration(ctx, orgID, newMainConfig)
		require.NoError(t, err)

		// Verify that the extra config is still present after applying the new main config
		updatedConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, updatedConfig.ExtraConfigs, 1)
		require.Equal(t, extraConfig.Identifier, updatedConfig.ExtraConfigs[0].Identifier)
		require.Equal(t, extraConfig.TemplateFiles, updatedConfig.ExtraConfigs[0].TemplateFiles)

		// Verify the main config was updated
		require.Equal(t, "main-receiver", updatedConfig.AlertmanagerConfig.Route.Receiver)
		require.Len(t, updatedConfig.AlertmanagerConfig.Receivers, 1)
		require.Equal(t, "main-receiver", updatedConfig.AlertmanagerConfig.Receivers[0].Name)
	})

	t.Run("SaveAndApplyAlertmanagerConfiguration handles missing extra_configs field", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// Apply initial config without extra_configs field
		initialConfig := definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "initial-receiver",
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "initial-receiver",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									Name:     "initial-receiver",
									Type:     "email",
									Settings: definitions.RawMessage(`{"addresses": "initial@grafana.com"}`),
								},
							},
						},
					},
				},
			},
		}

		err := mam.SaveAndApplyAlertmanagerConfiguration(ctx, orgID, initialConfig)
		require.NoError(t, err)

		// Apply a new main configuration
		newMainConfig := definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "main-receiver",
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "main-receiver",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									Name:     "main-receiver",
									Type:     "email",
									Settings: definitions.RawMessage(`{"addresses": "me@grafana.com"}`),
								},
							},
						},
					},
				},
			},
		}

		err = mam.SaveAndApplyAlertmanagerConfiguration(ctx, orgID, newMainConfig)
		require.NoError(t, err)

		// Verify that no extra configs are present and main config was updated
		updatedConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, updatedConfig.ExtraConfigs, 0)
		require.Equal(t, "main-receiver", updatedConfig.AlertmanagerConfig.Route.Receiver)
	})

	t.Run("SaveAndApplyAlertmanagerConfiguration handles empty extra_configs array", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// Apply initial config with empty extra_configs
		initialConfig := definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "initial-receiver",
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "initial-receiver",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									Name:     "initial-receiver",
									Type:     "email",
									Settings: definitions.RawMessage(`{"addresses": "initial@grafana.com"}`),
								},
							},
						},
					},
				},
			},
			ExtraConfigs: []definitions.ExtraConfiguration{}, // Empty array
		}

		err := mam.SaveAndApplyAlertmanagerConfiguration(ctx, orgID, initialConfig)
		require.NoError(t, err)

		// Apply a new main configuration
		newMainConfig := definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "main-receiver",
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "main-receiver",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									Name:     "main-receiver",
									Type:     "email",
									Settings: definitions.RawMessage(`{"addresses": "me@grafana.com"}`),
								},
							},
						},
					},
				},
			},
		}

		err = mam.SaveAndApplyAlertmanagerConfiguration(ctx, orgID, newMainConfig)
		require.NoError(t, err)

		// Verify that no extra configs are present and main config was updated
		updatedConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, updatedConfig.ExtraConfigs, 0)
		require.Equal(t, "main-receiver", updatedConfig.AlertmanagerConfig.Route.Receiver)
	})
}

func TestExtractExtraConfigs(t *testing.T) {
	t.Run("extracts extra configs from JSON", func(t *testing.T) {
		jsonConfig := `{
			"extra_config": [
				{
					"identifier": "test-config",
					"merge_matchers": [],
					"template_files": {"test.tmpl": "test"},
					"alertmanager_config": "route:\n  receiver: test"
				}
			]
		}`

		extraConfigs, err := extractExtraConfigs(jsonConfig)
		require.NoError(t, err)
		require.Len(t, extraConfigs, 1)
		require.Equal(t, "test-config", extraConfigs[0].Identifier)
	})

	t.Run("handles missing extra_config field", func(t *testing.T) {
		jsonConfig := `{"alertmanager_config": {"route": {"receiver": "test"}}}`

		extraConfigs, err := extractExtraConfigs(jsonConfig)
		require.NoError(t, err)
		require.Len(t, extraConfigs, 0)
	})

	t.Run("handles empty extra_config array", func(t *testing.T) {
		jsonConfig := `{"extra_config": []}`

		extraConfigs, err := extractExtraConfigs(jsonConfig)
		require.NoError(t, err)
		require.Len(t, extraConfigs, 0)
	})

	t.Run("handles null extra_config", func(t *testing.T) {
		jsonConfig := `{"extra_config": null}`

		extraConfigs, err := extractExtraConfigs(jsonConfig)
		require.NoError(t, err)
		require.Len(t, extraConfigs, 0)
	})
}

func TestMultiOrgAlertmanager_DeleteExtraConfiguration(t *testing.T) {
	orgID := int64(1)

	t.Run("successfully delete existing extra configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-identifier"

		extraConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: definitions.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "delete"}},
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}

		renamed, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, extraConfig, false, false)
		require.NoError(t, err)
		require.Empty(t, renamed.Receivers, "no renaming should occur")
		require.Empty(t, renamed.TimeIntervals, "no renaming should occur")

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)

		err = mam.DeleteExtraConfiguration(ctx, orgID, identifier)
		require.NoError(t, err)

		gettableConfig, err = mam.GetAlertmanagerConfiguration(ctx, orgID, false, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0)
	})

	t.Run("deletion of non-existent configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		err := mam.DeleteExtraConfiguration(ctx, orgID, "non-existent")
		require.NoError(t, err)
	})

	t.Run("deletion in non-existent org fails", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()

		err := mam.DeleteExtraConfiguration(ctx, 999, "test-config")
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to get current configuration")
	})
}

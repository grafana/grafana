package notifier

import (
	"context"
	"testing"

	amconfig "github.com/prometheus/alertmanager/config"
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
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "test-receiver"},
				},
			},
		}

		err := mam.SaveAndApplyExtraConfiguration(ctx, 999, extraConfig)
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to get current configuration")
	})

	t.Run("save new extra configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := definitions.ExtraConfiguration{
			Identifier:    "test-alertmanager-config",
			MergeMatchers: amconfig.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
			TemplateFiles: map[string]string{"test.tmpl": "{{ define \"test\" }}Test{{ end }}"},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "test-receiver"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: amconfig.Receiver{Name: "test-receiver"}},
				},
			},
		}

		err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, extraConfig)
		require.NoError(t, err)

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)
		require.Equal(t, extraConfig.Identifier, gettableConfig.ExtraConfigs[0].Identifier)
		require.Equal(t, extraConfig.TemplateFiles, gettableConfig.ExtraConfigs[0].TemplateFiles)
		require.Equal(t, extraConfig.AlertmanagerConfig.Route.Receiver, gettableConfig.ExtraConfigs[0].AlertmanagerConfig.Route.Receiver)
		require.Len(t, gettableConfig.ExtraConfigs[0].AlertmanagerConfig.Receivers, 1)
		require.Equal(t, "test-receiver", gettableConfig.ExtraConfigs[0].AlertmanagerConfig.Receivers[0].Name)
	})

	t.Run("replace existing extra configuration with same identifier", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-config"

		// First add a configuration
		originalConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: amconfig.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "original"}},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "original-receiver"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: amconfig.Receiver{Name: "original-receiver"}},
				},
			},
		}

		err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, originalConfig)
		require.NoError(t, err)

		// Now replace it
		updatedConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: amconfig.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "updated"}},
			TemplateFiles: map[string]string{"updated.tmpl": "{{ define \"updated\" }}Updated{{ end }}"},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "updated-receiver"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: amconfig.Receiver{Name: "updated-receiver"}},
				},
			},
		}

		err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, updatedConfig)
		require.NoError(t, err)

		// Verify only one config exists with updated content
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
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
			MergeMatchers: amconfig.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "first"}},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "first-receiver"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: amconfig.Receiver{Name: "first-receiver"}},
				},
			},
		}

		err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, firstConfig)
		require.NoError(t, err)

		secondConfig := definitions.ExtraConfiguration{
			Identifier:    "second-config",
			MergeMatchers: amconfig.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "second"}},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "second-receiver"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: amconfig.Receiver{Name: "second-receiver"}},
				},
			},
		}

		err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, secondConfig)
		require.Error(t, err)
		require.ErrorContains(t, err, "multiple extra configurations are not supported")
		require.ErrorContains(t, err, "first-config")
	})
}

func TestMultiOrgAlertmanager_DeleteAndApplyExtraConfiguration(t *testing.T) {
	orgID := int64(1)

	t.Run("successfully delete existing extra configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-identifier"

		extraConfig := definitions.ExtraConfiguration{
			Identifier:    identifier,
			MergeMatchers: amconfig.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "env", Value: "delete"}},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "test-receiver"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: amconfig.Receiver{Name: "test-receiver"}},
				},
			},
		}

		err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, extraConfig)
		require.NoError(t, err)

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)

		err = mam.DeleteAndApplyExtraConfiguration(ctx, orgID, identifier)
		require.NoError(t, err)

		gettableConfig, err = mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0)
	})

	t.Run("deletion of non-existent configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		err := mam.DeleteAndApplyExtraConfiguration(ctx, orgID, "non-existent")
		require.NoError(t, err)
	})

	t.Run("deletion in non-existent org fails", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()

		err := mam.DeleteAndApplyExtraConfiguration(ctx, 999, "test-config")
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to get current configuration")
	})
}

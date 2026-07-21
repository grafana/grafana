package notifier

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
	"github.com/grafana/grafana/pkg/services/user"
)

// noopExtraConfigAuthz permits all alertmanager import operations — for use in tests
// that exercise config logic rather than authorization.
type noopExtraConfigAuthz struct{}

func (noopExtraConfigAuthz) AuthorizeCreate(_ context.Context, _ identity.Requester) error {
	return nil
}
func (noopExtraConfigAuthz) AuthorizeUpdate(_ context.Context, _ identity.Requester, _ string) error {
	return nil
}
func (noopExtraConfigAuthz) AuthorizeDelete(_ context.Context, _ identity.Requester, _ string) error {
	return nil
}
func (noopExtraConfigAuthz) AuthorizePromote(_ context.Context, _ identity.Requester, _ merge.MergeResult) error {
	return nil
}

type stubExtraConfigAuthz struct {
	createErr  error
	updateErr  error
	deleteErr  error
	promoteErr error
}

func (s stubExtraConfigAuthz) AuthorizeCreate(_ context.Context, _ identity.Requester) error {
	return s.createErr
}
func (s stubExtraConfigAuthz) AuthorizeUpdate(_ context.Context, _ identity.Requester, _ string) error {
	return s.updateErr
}
func (s stubExtraConfigAuthz) AuthorizeDelete(_ context.Context, _ identity.Requester, _ string) error {
	return s.deleteErr
}
func (s stubExtraConfigAuthz) AuthorizePromote(_ context.Context, _ identity.Requester, _ merge.MergeResult) error {
	return s.promoteErr
}

func TestMultiOrgAlertmanager_SaveAndApplyExtraConfiguration(t *testing.T) {
	orgID := int64(1)

	t.Run("fails when organization does not exist", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := v1.ExtraConfiguration{
			Identifier: "test-config",
			AlertmanagerConfig: `route:
  receiver: test-receiver`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, 999, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, false, false)
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to get current configuration")
	})

	t.Run("save new extra configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := v1.ExtraConfiguration{
			Identifier:    "test-alertmanager-config",
			TemplateFiles: map[string]string{"test.tmpl": "{{ define \"test\" }}Test{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}

		renamed, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, false, false)
		require.NoError(t, err)
		require.Empty(t, renamed.Receivers, "no renaming should occur")
		require.Empty(t, renamed.TimeIntervals, "no renaming should occur")

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
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

		extraConfig := v1.ExtraConfiguration{
			Identifier:    "dry-run-config",
			TemplateFiles: map[string]string{"test.tmpl": "{{ define \"test\" }}Test{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}

		// Call with dryRun=true
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, true, false)
		require.NoError(t, err)

		// Verify configuration was NOT saved
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0, "configuration should not be saved in dry run mode")
	})

	t.Run("replace existing extra configuration with same identifier", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-config"

		// First add a configuration
		originalConfig := v1.ExtraConfiguration{
			Identifier: identifier,
			AlertmanagerConfig: `route:
  receiver: original-receiver
receivers:
  - name: original-receiver`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, originalConfig, false, false, false)
		require.NoError(t, err)

		// Now replace it
		updatedConfig := v1.ExtraConfiguration{
			Identifier:    identifier,
			TemplateFiles: map[string]string{"updated.tmpl": "{{ define \"updated\" }}Updated{{ end }}"},
			AlertmanagerConfig: `route:
  receiver: updated-receiver
receivers:
  - name: updated-receiver`,
		}

		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, updatedConfig, false, false, false)
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

		firstConfig := v1.ExtraConfiguration{
			Identifier: "first-config",
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

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, firstConfig, false, false, false)
		require.NoError(t, err)

		secondConfig := v1.ExtraConfiguration{
			Identifier: "second-config",
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

		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, secondConfig, false, false, false)
		require.Error(t, err)
		require.ErrorContains(t, err, "multiple extra configurations are not supported")
		require.ErrorContains(t, err, "first-config")

		t.Run("replaces if replace=true", func(t *testing.T) {
			_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, secondConfig, true, false, false)
			require.NoError(t, err)

			gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
			require.NoError(t, err)
			require.Len(t, gettableConfig.ExtraConfigs, 1)
			require.Equal(t, secondConfig.Identifier, gettableConfig.ExtraConfigs[0].Identifier)
		})
	})

	t.Run("promote merges extra config into main config", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "promoted-config"
		extraConfig := v1.ExtraConfiguration{
			Identifier:    identifier,
			TemplateFiles: map[string]string{"promoted.tmpl": `{{ define "promoted" }}Promoted{{ end }}`},
			AlertmanagerConfig: `route:
  receiver: promoted-receiver
receivers:
  - name: promoted-receiver`,
		}

		result, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, false, true)
		require.NoError(t, err)
		require.Equal(t, identifier, result.AddedRoute)
		require.Contains(t, result.AddedReceivers, "promoted-receiver")
		require.Len(t, result.AddedTemplates, 1, "one template UID should be reported as added")

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		// Promoted config is merged into main config, so ExtraConfigs should be empty.
		require.Empty(t, gettableConfig.ExtraConfigs)
		// The promoted receiver should appear in the main alertmanager config.
		receiverNames := make([]string, 0, len(gettableConfig.AlertmanagerConfig.Receivers))
		for _, r := range gettableConfig.AlertmanagerConfig.Receivers {
			receiverNames = append(receiverNames, r.Name)
		}
		require.Contains(t, receiverNames, "promoted-receiver")

		// Promoted resources must not be provisioned (ProvenanceNone), so they remain editable.
		rawCfg, err := mam.configStore.GetLatestAlertmanagerConfiguration(ctx, orgID)
		require.NoError(t, err)
		cfg, err := Load([]byte(rawCfg.AlertmanagerConfiguration))
		require.NoError(t, err)
		for _, tmpl := range cfg.Templates {
			if tmpl.Title == "promoted.tmpl" {
				require.Equal(t, models.ProvenanceNone, tmpl.Provenance,
					"promoted template must have ProvenanceNone, not provisioned")
				return
			}
		}
		t.Fatal("promoted.tmpl not found in raw config templates")
	})

	t.Run("non-promoted extra config templates are provisioned", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		extraConfig := v1.ExtraConfiguration{
			Identifier:    "imported-config",
			TemplateFiles: map[string]string{"imported.tmpl": `{{ define "imported" }}Imported{{ end }}`},
			AlertmanagerConfig: `route:
  receiver: imported-receiver
receivers:
  - name: imported-receiver`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, false, false)
		require.NoError(t, err)

		// Non-promoted templates stay in ExtraConfigs and are not merged into cfg.Templates.
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)

		// The merged (runtime) config still carries the template with ConvertedPrometheus provenance.
		rawCfg, err := mam.configStore.GetLatestAlertmanagerConfiguration(ctx, orgID)
		require.NoError(t, err)
		cfg, err := Load([]byte(rawCfg.AlertmanagerConfiguration))
		require.NoError(t, err)
		// Raw config should have no templates at the top level — they live in ExtraConfigs.
		for _, tmpl := range cfg.Templates {
			require.NotEqual(t, "imported.tmpl", tmpl.Title, "non-promoted template must not appear in top-level Templates")
		}
	})

	t.Run("fail to create extra configuration with identifier that used in managed routes", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-config"

		cfg := v1.AMConfigV1{
			ManagedRoutes: map[string]*v1.Route{
				identifier: {Receiver: "initial-receiver"},
			},
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Route: &v1.Route{
						Receiver: "initial-receiver",
					},
				},
				Receivers: []*v1.PostableApiReceiver{
					{
						Receiver: definitions.Receiver{
							Name: "initial-receiver",
						},
					},
				},
			},
		}

		cfgToSave, err := legacy_storage.SerializeAlertmanagerConfig(cfg)
		require.NoError(t, err)

		err = mam.configStore.SaveAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(cfgToSave),
			Default:                   false,
			ConfigurationVersion:      fmt.Sprintf("v%d", models.AlertConfigurationVersion),
			OrgID:                     orgID,
			LastApplied:               time.Now().UTC().Unix(),
		})
		require.NoError(t, err)

		originalConfig := v1.ExtraConfiguration{
			Identifier: identifier,
			AlertmanagerConfig: `route:
  receiver: original-receiver
receivers:
  - name: original-receiver`,
		}

		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, originalConfig, false, false, false)
		require.ErrorIs(t, err, ErrIdentifierAlreadyExists)
	})
}

func TestMultiOrgAlertmanager_DeleteExtraConfiguration(t *testing.T) {
	orgID := int64(1)

	t.Run("successfully delete existing extra configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		identifier := "test-identifier"

		extraConfig := v1.ExtraConfiguration{
			Identifier: identifier,
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}

		renamed, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, false, false)
		require.NoError(t, err)
		require.Empty(t, renamed.Receivers, "no renaming should occur")
		require.Empty(t, renamed.TimeIntervals, "no renaming should occur")

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)

		err = mam.DeleteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, identifier)
		require.NoError(t, err)

		gettableConfig, err = mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0)
	})

	t.Run("deletion of non-existent configuration", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		err := mam.DeleteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, "non-existent")
		require.NoError(t, err)
	})

	t.Run("deletion in non-existent org fails", func(t *testing.T) {
		mam := setupMam(t, nil)
		ctx := context.Background()

		err := mam.DeleteExtraConfiguration(ctx, 999, &user.SignedInUser{}, noopExtraConfigAuthz{}, "test-config")
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to get current configuration")
	})
}

func TestMultiOrgAlertmanager_ExtraConfigurationAuthz(t *testing.T) {
	orgID := int64(1)
	ctx := context.Background()

	validConfig := v1.ExtraConfiguration{
		Identifier: "config-a",
		AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
	}

	t.Run("SaveAndApply: AuthorizeCreate denied", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		authz := stubExtraConfigAuthz{createErr: errors.New("forbidden")}
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, authz, validConfig, false, false, false)
		require.Error(t, err)

		// Verify no config was saved.
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0)
	})

	t.Run("SaveAndApply: AuthorizeUpdate denied", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// Save the config first with noop authz.
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, validConfig, false, false, false)
		require.NoError(t, err)

		// Try updating with update denied.
		authz := stubExtraConfigAuthz{updateErr: errors.New("forbidden")}
		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, authz, validConfig, false, false, false)
		require.Error(t, err)
	})

	t.Run("SaveAndApply replace=true: AuthorizeDelete denied for displaced config", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// Save config A first.
		configA := v1.ExtraConfiguration{
			Identifier: "config-a",
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, configA, false, false, false)
		require.NoError(t, err)

		// Try to save config B with replace=true, but delete is denied.
		configB := v1.ExtraConfiguration{
			Identifier: "config-b",
			AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
		}
		authz := stubExtraConfigAuthz{deleteErr: errors.New("forbidden")}
		_, err = mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, authz, configB, true, false, false)
		require.Error(t, err)
	})

	t.Run("SaveAndApply promote=true: AuthorizePromote denied", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		authz := stubExtraConfigAuthz{promoteErr: errors.New("forbidden")}
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, authz, validConfig, false, false, true)
		require.Error(t, err)

		// Verify no config was saved.
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 0)
	})

	t.Run("Delete: AuthorizeDelete denied", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// Save config first.
		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, validConfig, false, false, false)
		require.NoError(t, err)

		// Try to delete with delete denied.
		authz := stubExtraConfigAuthz{deleteErr: errors.New("forbidden")}
		err = mam.DeleteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, authz, validConfig.Identifier)
		require.Error(t, err)

		// Verify config still exists.
		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)
		require.Len(t, gettableConfig.ExtraConfigs, 1)
	})
}

func TestMultiOrgAlertmanager_PromoteExtraConfiguration(t *testing.T) {
	orgID := int64(1)
	ctx := context.Background()

	extraConfig := v1.ExtraConfiguration{
		Identifier: "my-import",
		AlertmanagerConfig: `route:
  receiver: imported-receiver
receivers:
  - name: imported-receiver`,
	}

	t.Run("promotes staged config into main config", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig, false, false, false)
		require.NoError(t, err)

		renamed, err := mam.PromoteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig.Identifier)
		require.NoError(t, err)
		require.Empty(t, renamed.Receivers, "no renames expected")
		require.Empty(t, renamed.TimeIntervals, "no renames expected")

		gettableConfig, err := mam.GetAlertmanagerConfiguration(ctx, orgID, false)
		require.NoError(t, err)

		// ExtraConfigs must be empty after promotion.
		require.Empty(t, gettableConfig.ExtraConfigs, "extra config must be removed after promotion")

		// Imported receiver must now be in the main config.
		receiverNames := make([]string, 0, len(gettableConfig.AlertmanagerConfig.Receivers))
		for _, r := range gettableConfig.AlertmanagerConfig.Receivers {
			receiverNames = append(receiverNames, r.Name)
		}
		require.Contains(t, receiverNames, "imported-receiver")
	})

	t.Run("returns not-found error when identifier does not exist", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		_, err := mam.PromoteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, "nonexistent")
		require.Error(t, err)
		require.ErrorIs(t, err, ErrAlertmanagerExtraConfigNotFound)
	})

	t.Run("returns error when org does not exist", func(t *testing.T) {
		mam := setupMam(t, nil)

		_, err := mam.PromoteExtraConfiguration(ctx, 999, &user.SignedInUser{}, noopExtraConfigAuthz{}, extraConfig.Identifier)
		require.ErrorContains(t, err, "failed to get current configuration")
	})

	t.Run("renames receiver on name collision", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// The default Grafana config already has a receiver named "grafana-default-email".
		// Import a config whose receiver collides with it.
		colliding := v1.ExtraConfiguration{
			Identifier: "importer",
			AlertmanagerConfig: `route:
  receiver: grafana-default-email
receivers:
  - name: grafana-default-email`,
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, colliding, false, false, false)
		require.NoError(t, err)

		renamed, err := mam.PromoteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, "importer")
		require.NoError(t, err)
		require.NotEmpty(t, renamed.Receivers, "collision must produce a rename")
	})

	t.Run("promoted templates have no converted_prometheus provenance in config blob", func(t *testing.T) {
		mam := setupMam(t, nil)
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		withTemplate := v1.ExtraConfiguration{
			Identifier: "tmpl-import",
			AlertmanagerConfig: `route:
  receiver: tmpl-receiver
receivers:
  - name: tmpl-receiver`,
			TemplateFiles: map[string]string{
				"my-template": `{{ define "my-template" }}hello{{ end }}`,
			},
		}

		_, err := mam.SaveAndApplyExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, withTemplate, false, false, false)
		require.NoError(t, err)

		_, err = mam.PromoteExtraConfiguration(ctx, orgID, &user.SignedInUser{}, noopExtraConfigAuthz{}, "tmpl-import")
		require.NoError(t, err)

		// Load the raw config and verify templates don't have converted_prometheus provenance.
		raw, err := mam.configStore.GetLatestAlertmanagerConfiguration(ctx, orgID)
		require.NoError(t, err)
		cfg, err := Load([]byte(raw.AlertmanagerConfiguration))
		require.NoError(t, err)
		for _, tmpl := range cfg.Templates {
			require.NotEqual(t, definitions.Provenance(models.ProvenanceConvertedPrometheus), tmpl.Provenance,
				"template %q must not have converted_prometheus provenance after promotion", tmpl.Title)
		}
	})
}

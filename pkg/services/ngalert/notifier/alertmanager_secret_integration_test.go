package notifier

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestSaveAndApplyConfig_WithExternalSecrets(t *testing.T) {
	am := setupAMTest(t)

	// Create a simple configuration with ExtraConfigs
	cfg := &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: "default-receiver",
				},
			},
			Receivers: []*definitions.PostableApiReceiver{
				{
					Receiver: config.Receiver{Name: "default-receiver"},
				},
			},
		},
		ExtraConfigs: []definitions.ExtraConfiguration{
			{
				Identifier:    "external-mimir",
				MergeMatchers: []*labels.Matcher{{Type: labels.MatchEqual, Name: "cluster", Value: "prod"}},
				AlertmanagerConfig: `route:
  receiver: external-receiver
receivers:
  - name: external-receiver`,
			},
		},
	}

	// Save and apply config - this should extract and encrypt secrets
	err := am.SaveAndApplyConfig(context.Background(), cfg)
	require.NoError(t, err)

	// Get the latest configuration from the database
	savedConfig, err := am.Store.GetLatestAlertmanagerConfiguration(context.Background(), am.Base.TenantID())
	require.NoError(t, err)

	var savedUserConfig definitions.PostableUserConfig
	err = json.Unmarshal([]byte(savedConfig.AlertmanagerConfiguration), &savedUserConfig)
	require.NoError(t, err)

	// Verify we have ExtraConfigs
	require.Len(t, savedUserConfig.ExtraConfigs, 1)
	extraConfig := savedUserConfig.ExtraConfigs[0]
	require.Equal(t, "external-mimir", extraConfig.Identifier)

	// Apply the saved configuration - this should restore any secrets
	err = am.ApplyConfig(context.Background(), savedConfig)
	require.NoError(t, err)

	// Verify that the alertmanager is ready and the configuration was applied
	require.True(t, am.Ready())
}

func TestApplyConfig_WithEncryptedExternalSecrets(t *testing.T) {
	am := setupAMTest(t)

	cfg := &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: "default-receiver",
				},
			},
			Receivers: []*definitions.PostableApiReceiver{
				{
					Receiver: config.Receiver{Name: "default-receiver"},
				},
			},
		},
		ExtraConfigs: []definitions.ExtraConfiguration{
			{
				Identifier:    "external-mimir",
				MergeMatchers: []*labels.Matcher{{Type: labels.MatchEqual, Name: "cluster", Value: "prod"}},
				AlertmanagerConfig: `route:
  receiver: external-receiver
receivers:
  - name: external-receiver`,
			},
		},
	}

	// Use SaveAndApplyConfig to test the full encryption/decryption flow
	err := am.SaveAndApplyConfig(context.Background(), cfg)
	require.NoError(t, err)

	// Get the saved configuration and apply it to test decryption
	savedConfig, err := am.Store.GetLatestAlertmanagerConfiguration(context.Background(), am.Base.TenantID())
	require.NoError(t, err)

	// Apply the saved (encrypted) configuration - this should decrypt and work correctly
	err = am.ApplyConfig(context.Background(), savedConfig)
	require.NoError(t, err)

	// Verify that the alertmanager is ready
	require.True(t, am.Ready())
}

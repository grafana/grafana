package migration

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

func Test_validateAlertmanagerConfig(t *testing.T) {
	tc := []struct {
		name      string
		receivers []*apimodels.PostableGrafanaReceiver
		err       error
	}{
		{
			name: "when a slack receiver does not have a valid URL - it should error",
			receivers: []*apimodels.PostableGrafanaReceiver{
				{
					UID:            "test-uid",
					Name:           "SlackWithBadURL",
					Type:           "slack",
					Settings:       mustRawMessage(map[string]any{}),
					SecureSettings: map[string]string{"url": invalidUri},
				},
			},
			err: fmt.Errorf("failed to validate integration \"SlackWithBadURL\" (UID test-uid) of type \"slack\": invalid URL %q", invalidUri),
		},
		{
			name: "when a slack receiver has an invalid recipient - it should not error",
			receivers: []*apimodels.PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadRecipient",
					Type:           "slack",
					Settings:       mustRawMessage(map[string]any{"recipient": "this passes"}),
					SecureSettings: map[string]string{"url": "http://webhook.slack.com/myuser"},
				},
			},
		},
		{
			name: "when the configuration is valid - it should not error",
			receivers: []*apimodels.PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadURL",
					Type:           "slack",
					Settings:       mustRawMessage(map[string]interface{}{"recipient": "#a-good-channel"}),
					SecureSettings: map[string]string{"url": "http://webhook.slack.com/myuser"},
				},
			},
		},
	}

	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			mg := service.newOrgMigration(1)

			config := configFromReceivers(t, tt.receivers)
			require.NoError(t, encryptSecureSettings(config, mg)) // make sure we encrypt the settings
			err := mg.validateAlertmanagerConfig(config)
			if tt.err != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func configFromReceivers(t *testing.T, receivers []*apimodels.PostableGrafanaReceiver) *apimodels.PostableUserConfig {
	t.Helper()

	return &apimodels.PostableUserConfig{
		AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
			Receivers: []*apimodels.PostableApiReceiver{
				{PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: receivers}},
			},
		},
	}
}

func encryptSecureSettings(c *apimodels.PostableUserConfig, m *OrgMigration) error {
	for _, r := range c.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			err := m.encryptSecureSettings(gr.SecureSettings)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

const invalidUri = "�6�M��)uk譹1(�h`$�o�N>mĕ����cS2�dh![ę�	���`csB�!��OSxP�{�"

func Test_getAlertFolderNameFromDashboard(t *testing.T) {
	t.Run("should include full title", func(t *testing.T) {
		dash := &dashboards.Dashboard{
			UID:   util.GenerateShortUID(),
			Title: "TEST",
		}
		folder := getAlertFolderNameFromDashboard(dash)
		require.Contains(t, folder, dash.Title)
		require.Contains(t, folder, dash.UID)
	})
	t.Run("should cut title to the length", func(t *testing.T) {
		title := ""
		for {
			title += util.GenerateShortUID()
			if len(title) > MaxFolderName {
				title = title[:MaxFolderName]
				break
			}
		}

		dash := &dashboards.Dashboard{
			UID:   util.GenerateShortUID(),
			Title: title,
		}
		folder := getAlertFolderNameFromDashboard(dash)
		require.Len(t, folder, MaxFolderName)
		require.Contains(t, folder, dash.UID)
	})
}

func Test_shortUIDCaseInsensitiveConflicts(t *testing.T) {
	s := Deduplicator{
		set:             make(map[string]struct{}),
		caseInsensitive: true,
	}

	// 10000 uids seems to be enough to cause a collision in almost every run if using util.GenerateShortUID directly.
	for i := 0; i < 10000; i++ {
		s.add(util.GenerateShortUID())
	}

	// check if any are case-insensitive duplicates.
	deduped := make(map[string]struct{})
	for k := range s.set {
		deduped[strings.ToLower(k)] = struct{}{}
	}

	require.Equal(t, len(s.set), len(deduped))
}

func mustRawMessage[T any](s T) apimodels.RawMessage {
	js, _ := json.Marshal(s)
	return js
}

package ualert

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/util"
)

var MigTitle = migTitle
var RmMigTitle = rmMigTitle
var ClearMigrationEntryTitle = clearMigrationEntryTitle

type RmMigration = rmMigration

// UnmarshalJSON implements the json.Unmarshaler interface for Matchers. Vendored from definitions.ObjectMatchers.
func (m *ObjectMatchers) UnmarshalJSON(data []byte) error {
	var rawMatchers [][3]string
	if err := json.Unmarshal(data, &rawMatchers); err != nil {
		return err
	}
	for _, rawMatcher := range rawMatchers {
		var matchType labels.MatchType
		switch rawMatcher[1] {
		case "=":
			matchType = labels.MatchEqual
		case "!=":
			matchType = labels.MatchNotEqual
		case "=~":
			matchType = labels.MatchRegexp
		case "!~":
			matchType = labels.MatchNotRegexp
		default:
			return fmt.Errorf("unsupported match type %q in matcher", rawMatcher[1])
		}

		rawMatcher[2] = strings.TrimPrefix(rawMatcher[2], "\"")
		rawMatcher[2] = strings.TrimSuffix(rawMatcher[2], "\"")

		matcher, err := labels.NewMatcher(matchType, rawMatcher[0], rawMatcher[2])
		if err != nil {
			return err
		}
		*m = append(*m, matcher)
	}
	sort.Sort(labels.Matchers(*m))
	return nil
}

func Test_validateAlertmanagerConfig(t *testing.T) {
	tc := []struct {
		name      string
		receivers []*PostableGrafanaReceiver
		err       error
	}{
		{
			name: "when a slack receiver does not have a valid URL - it should error",
			receivers: []*PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadURL",
					Type:           "slack",
					Settings:       simplejson.NewFromAny(map[string]interface{}{}),
					SecureSettings: map[string]string{"url": invalidUri},
				},
			},
			err: fmt.Errorf("failed to validate receiver \"SlackWithBadURL\" of type \"slack\": invalid URL %q", invalidUri),
		},
		{
			name: "when a slack receiver has an invalid recipient - it should not error",
			receivers: []*PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadRecipient",
					Type:           "slack",
					Settings:       simplejson.NewFromAny(map[string]interface{}{"recipient": "this passes"}),
					SecureSettings: map[string]string{"url": "http://webhook.slack.com/myuser"},
				},
			},
		},
		{
			name: "when the configuration is valid - it should not error",
			receivers: []*PostableGrafanaReceiver{
				{
					UID:            util.GenerateShortUID(),
					Name:           "SlackWithBadURL",
					Type:           "slack",
					Settings:       simplejson.NewFromAny(map[string]interface{}{"recipient": "#a-good-channel"}),
					SecureSettings: map[string]string{"url": "http://webhook.slack.com/myuser"},
				},
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			mg := newTestMigration(t)
			orgID := int64(1)

			config := configFromReceivers(t, tt.receivers)
			require.NoError(t, config.EncryptSecureSettings()) // make sure we encrypt the settings
			err := mg.validateAlertmanagerConfig(orgID, config)
			if tt.err != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func configFromReceivers(t *testing.T, receivers []*PostableGrafanaReceiver) *PostableUserConfig {
	t.Helper()

	return &PostableUserConfig{
		AlertmanagerConfig: PostableApiAlertingConfig{
			Receivers: []*PostableApiReceiver{
				{GrafanaManagedReceivers: receivers},
			},
		},
	}
}

func (c *PostableUserConfig) EncryptSecureSettings() error {
	for _, r := range c.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			encryptedData := GetEncryptedJsonData(gr.SecureSettings)
			for k, v := range encryptedData {
				gr.SecureSettings[k] = base64.StdEncoding.EncodeToString(v)
			}
		}
	}
	return nil
}

const invalidUri = "�6�M��)uk譹1(�h`$�o�N>mĕ����cS2�dh![ę�	���`csB�!��OSxP�{�"

func Test_getAlertFolderNameFromDashboard(t *testing.T) {
	t.Run("should include full title", func(t *testing.T) {
		dash := &dashboard{
			Uid:   util.GenerateShortUID(),
			Title: "TEST",
		}
		folder := getAlertFolderNameFromDashboard(dash)
		require.Contains(t, folder, dash.Title)
		require.Contains(t, folder, dash.Uid)
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

		dash := &dashboard{
			Uid:   util.GenerateShortUID(),
			Title: title,
		}
		folder := getAlertFolderNameFromDashboard(dash)
		require.Len(t, folder, MaxFolderName)
		require.Contains(t, folder, dash.Uid)
	})
}

func Test_shortUIDCaseInsensitiveConflicts(t *testing.T) {
	s := uidSet{
		set:             make(map[string]struct{}),
		caseInsensitive: true,
	}

	// 10000 uids seems to be enough to cause a collision in almost every run if using util.GenerateShortUID directly.
	for i := 0; i < 10000; i++ {
		_, _ = s.generateUid()
	}

	// check if any are case-insensitive duplicates.
	deduped := make(map[string]struct{})
	for k := range s.set {
		deduped[strings.ToLower(k)] = struct{}{}
	}

	require.Equal(t, len(s.set), len(deduped))
}

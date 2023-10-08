package migration

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestCreateRoute(t *testing.T) {
	tc := []struct {
		name     string
		channel  *legacymodels.AlertNotification
		recv     *apimodels.PostableApiReceiver
		expected *apimodels.Route
	}{
		{
			name:    "when a receiver is passed in, the route should exact match based on channel uid with continue=true",
			channel: &legacymodels.AlertNotification{UID: "uid1"},
			recv:    createPostableApiReceiver("uid1", "recv1", nil),
			expected: &apimodels.Route{
				Receiver:       "recv1",
				ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
		{
			name:    "notification channel should be escaped for regex in the matcher",
			channel: &legacymodels.AlertNotification{UID: "uid1"},
			recv:    createPostableApiReceiver("uid1", `. ^ $ * + - ? ( ) [ ] { } \ |`, nil),
			expected: &apimodels.Route{
				Receiver:       `. ^ $ * + - ? ( ) [ ] { } \ |`,
				ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
		{
			name:    "when a channel has sendReminder=true, the route should use the frequency in repeat interval",
			channel: &legacymodels.AlertNotification{SendReminder: true, Frequency: time.Duration(42) * time.Hour, UID: "uid1"},
			recv:    createPostableApiReceiver("uid1", "recv1", nil),
			expected: &apimodels.Route{
				Receiver:       "recv1",
				ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(model.Duration(time.Duration(42) * time.Hour)),
			},
		},
		{
			name:    "when a channel has sendReminder=false, the route should ignore the frequency in repeat interval and use DisabledRepeatInterval",
			channel: &legacymodels.AlertNotification{SendReminder: false, Frequency: time.Duration(42) * time.Hour, UID: "uid1"},
			recv:    createPostableApiReceiver("uid1", "recv1", nil),
			expected: &apimodels.Route{
				Receiver:       "recv1",
				ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			res := createRoute(tt.channel, tt.recv.Name)

			// Order of nested routes is not guaranteed.
			cOpt := []cmp.Option{
				cmpopts.SortSlices(func(a, b *apimodels.Route) bool {
					if a.Receiver != b.Receiver {
						return a.Receiver < b.Receiver
					}
					return a.ObjectMatchers[0].Value < b.ObjectMatchers[0].Value
				}),
				cmpopts.IgnoreUnexported(apimodels.Route{}, labels.Matcher{}),
			}

			if !cmp.Equal(tt.expected, res, cOpt...) {
				t.Errorf("Unexpected Route: %v", cmp.Diff(tt.expected, res, cOpt...))
			}
		})
	}
}

func createNotChannel(t *testing.T, uid string, id int64, name string, isDefault bool, frequency time.Duration) *legacymodels.AlertNotification {
	t.Helper()
	return &legacymodels.AlertNotification{
		OrgID:        1,
		UID:          uid,
		ID:           id,
		Name:         name,
		Type:         "email",
		SendReminder: frequency > 0,
		Frequency:    frequency,
		Settings:     simplejson.New(),
		IsDefault:    isDefault,
		Created:      now,
		Updated:      now,
	}
}

func TestCreateReceivers(t *testing.T) {
	tc := []struct {
		name    string
		channel *legacymodels.AlertNotification
		expRecv *apimodels.PostableApiReceiver
		expErr  error
	}{
		{
			name:    "when given notification channels migrate them to receivers",
			channel: createNotChannel(t, "uid1", int64(1), "name1", false, 0),
			expRecv: createPostableApiReceiver("uid1", "name1", []string{"name1"}),
		},
	}

	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			recv, err := m.createReceiver(tt.channel)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expRecv, recv)
		})
	}
}

func TestMigrateNotificationChannelSecureSettings(t *testing.T) {
	legacyEncryptFn := func(data string) string {
		raw, err := util.Encrypt([]byte(data), setting.SecretKey)
		require.NoError(t, err)
		return string(raw)
	}
	decryptFn := func(data string, m *OrgMigration) string {
		decoded, err := base64.StdEncoding.DecodeString(data)
		require.NoError(t, err)
		raw, err := m.encryptionService.Decrypt(context.Background(), decoded)
		require.NoError(t, err)
		return string(raw)
	}
	gen := func(nType string, fn func(channel *legacymodels.AlertNotification)) *legacymodels.AlertNotification {
		not := &legacymodels.AlertNotification{
			UID:  "uid",
			ID:   1,
			Name: "channel name",
			Type: nType,
			Settings: simplejson.NewFromAny(map[string]any{
				"something": "some value",
			}),
			SecureSettings: map[string][]byte{},
		}
		if fn != nil {
			fn(not)
		}
		return not
	}
	genExpSlack := func(fn func(channel *apimodels.PostableGrafanaReceiver)) *apimodels.PostableGrafanaReceiver {
		rawSettings, err := json.Marshal(map[string]string{
			"something": "some value",
		})
		require.NoError(t, err)

		recv := &apimodels.PostableGrafanaReceiver{
			UID:      "uid",
			Name:     "channel name",
			Type:     "slack",
			Settings: rawSettings,
			SecureSettings: map[string]string{
				"token": "secure token",
				"url":   "secure url",
			},
		}

		if fn != nil {
			fn(recv)
		}
		return recv
	}

	tc := []struct {
		name    string
		channel *legacymodels.AlertNotification
		expRecv *apimodels.PostableGrafanaReceiver
		expErr  error
	}{
		{
			name: "when secure settings exist, migrate them to receiver secure settings",
			channel: gen("slack", func(channel *legacymodels.AlertNotification) {
				channel.SecureSettings = map[string][]byte{
					"token": []byte(legacyEncryptFn("secure token")),
					"url":   []byte(legacyEncryptFn("secure url")),
				}
			}),
			expRecv: genExpSlack(nil),
		},
		{
			name:    "when no secure settings are encrypted, do nothing",
			channel: gen("slack", nil),
			expRecv: genExpSlack(func(recv *apimodels.PostableGrafanaReceiver) {
				delete(recv.SecureSettings, "token")
				delete(recv.SecureSettings, "url")
			}),
		},
		{
			name: "when some secure settings are available unencrypted in settings, migrate them to secureSettings and encrypt",
			channel: gen("slack", func(channel *legacymodels.AlertNotification) {
				channel.SecureSettings = map[string][]byte{
					"url": []byte(legacyEncryptFn("secure url")),
				}
				channel.Settings.Set("token", "secure token")
			}),
			expRecv: genExpSlack(nil),
		},
	}
	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			recv, err := m.createNotifier(tt.channel)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}
			require.NoError(t, err)

			if len(tt.expRecv.SecureSettings) > 0 {
				require.NotEqual(t, tt.expRecv, recv) // Make sure they were actually encrypted at first.
			}
			for k, v := range recv.SecureSettings {
				recv.SecureSettings[k] = decryptFn(v, m)
			}
			require.Equal(t, tt.expRecv, recv)
		})
	}

	// Generate tests for each notification channel type.
	t.Run("secure settings migrations for each notifier type", func(t *testing.T) {
		notifiers := channels_config.GetAvailableNotifiers()
		t.Run("migrate notification channel secure settings to receiver secure settings", func(t *testing.T) {
			for _, notifier := range notifiers {
				nType := notifier.Type
				secureSettings, err := channels_config.GetSecretKeysForContactPointType(nType)
				require.NoError(t, err)
				t.Run(nType, func(t *testing.T) {
					service := NewTestMigrationService(t, sqlStore, nil)
					m := service.newOrgMigration(1)
					channel := gen(nType, func(channel *legacymodels.AlertNotification) {
						for _, key := range secureSettings {
							channel.SecureSettings[key] = []byte(legacyEncryptFn("secure " + key))
						}
					})
					recv, err := m.createNotifier(channel)
					require.NoError(t, err)

					require.Equal(t, nType, recv.Type)
					if len(secureSettings) > 0 {
						for _, key := range secureSettings {
							require.NotEqual(t, "secure "+key, recv.SecureSettings[key]) // Make sure they were actually encrypted at first.
						}
					}
					require.Len(t, recv.SecureSettings, len(secureSettings))
					for _, key := range secureSettings {
						require.Equal(t, "secure "+key, decryptFn(recv.SecureSettings[key], m))
					}
				})
			}
		})

		t.Run("for certain legacy channel types, migrate secure fields stored in settings to secure settings", func(t *testing.T) {
			for _, notifier := range notifiers {
				nType := notifier.Type
				secureSettings, ok := secureKeysToMigrate[nType]
				if !ok {
					continue
				}
				t.Run(nType, func(t *testing.T) {
					service := NewTestMigrationService(t, sqlStore, nil)
					m := service.newOrgMigration(1)

					channel := gen(nType, func(channel *legacymodels.AlertNotification) {
						for _, key := range secureSettings {
							// Key difference to above. We store the secure settings in the settings field and expect
							// them to be migrated to secureSettings.
							channel.Settings.Set(key, "secure "+key)
						}
					})
					recv, err := m.createNotifier(channel)
					require.NoError(t, err)

					require.Equal(t, nType, recv.Type)
					if len(secureSettings) > 0 {
						for _, key := range secureSettings {
							require.NotEqual(t, "secure "+key, recv.SecureSettings[key]) // Make sure they were actually encrypted at first.
						}
					}
					require.Len(t, recv.SecureSettings, len(secureSettings))
					for _, key := range secureSettings {
						require.Equal(t, "secure "+key, decryptFn(recv.SecureSettings[key], m))
					}
				})
			}
		})
	})
}

func TestSetupAlertmanagerConfig(t *testing.T) {
	tc := []struct {
		name     string
		channels []*legacymodels.AlertNotification
		amConfig *apimodels.PostableUserConfig
		expErr   error
	}{
		{
			name:     "when given multiple notification channels migrate them to receivers",
			channels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "notifier1", false, 0), createNotChannel(t, "uid2", int64(2), "notifier2", false, 0)},
			amConfig: &apimodels.PostableUserConfig{
				AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
					Config: apimodels.Config{Route: &apimodels.Route{
						Receiver:   "autogen-contact-point-default",
						GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
						Routes: []*apimodels.Route{
							{
								ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: migmodels.UseLegacyChannelsLabel, Value: "true"}},
								Continue:       true,
								Routes: []*apimodels.Route{
									{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
									{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid2"), Value: "true"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								},
							},
						},
					}},
					Receivers: []*apimodels.PostableApiReceiver{
						{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{}}},
						createPostableApiReceiver("uid1", "notifier1", []string{"notifier1"}),
						createPostableApiReceiver("uid2", "notifier2", []string{"notifier2"}),
					},
				},
			},
		},
		{
			name:     "when given default notification channels migrate them to a routes with catchall matcher",
			channels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "notifier1", false, 0), createNotChannel(t, "uid2", int64(2), "notifier2", true, 0)},
			amConfig: &apimodels.PostableUserConfig{
				AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
					Config: apimodels.Config{Route: &apimodels.Route{
						Receiver:   "autogen-contact-point-default",
						GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
						Routes: []*apimodels.Route{
							{
								ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: migmodels.UseLegacyChannelsLabel, Value: "true"}},
								Continue:       true,
								Routes: []*apimodels.Route{
									{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchRegexp, Name: model.AlertNameLabel, Value: ".+"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
									{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(DisabledRepeatInterval)},
								},
							},
						},
					}},
					Receivers: []*apimodels.PostableApiReceiver{
						{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{}}},
						createPostableApiReceiver("uid1", "notifier1", []string{"notifier1"}),
						createPostableApiReceiver("uid2", "notifier2", []string{"notifier2"}),
					},
				},
			},
		},
		{
			name:     "when given notification channels with SendReminder true migrate them to a route with frequency set",
			channels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "notifier1", false, time.Duration(42)), createNotChannel(t, "uid2", int64(2), "notifier2", false, time.Duration(43))},
			amConfig: &apimodels.PostableUserConfig{
				AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
					Config: apimodels.Config{Route: &apimodels.Route{
						Receiver:   "autogen-contact-point-default",
						GroupByStr: []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
						Routes: []*apimodels.Route{
							{
								ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: migmodels.UseLegacyChannelsLabel, Value: "true"}},
								Continue:       true,
								Routes: []*apimodels.Route{
									{Receiver: "notifier1", ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid1"), Value: "true"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(42)},
									{Receiver: "notifier2", ObjectMatchers: apimodels.ObjectMatchers{{Type: labels.MatchEqual, Name: fmt.Sprintf(ContactLabelTemplate, "uid2"), Value: "true"}}, Routes: nil, Continue: true, RepeatInterval: durationPointer(43)},
								},
							},
						},
					}},
					Receivers: []*apimodels.PostableApiReceiver{
						{Receiver: config.Receiver{Name: "autogen-contact-point-default"}, PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{}}},
						createPostableApiReceiver("uid1", "notifier1", []string{"notifier1"}),
						createPostableApiReceiver("uid2", "notifier2", []string{"notifier2"})},
				},
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			sqlStore := db.InitTestDB(t)

			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			am := migmodels.FromPostableUserConfig(nil)
			_, err := m.migrateChannels(am, tt.channels)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}
			require.NoError(t, err)

			amConfig := am.CleanConfig()
			opts := []cmp.Option{
				cmpopts.IgnoreUnexported(apimodels.PostableUserConfig{}, labels.Matcher{}),
				cmpopts.SortSlices(func(a, b *apimodels.Route) bool { return a.Receiver < b.Receiver }),
			}
			if !cmp.Equal(tt.amConfig, amConfig, opts...) {
				t.Errorf("Unexpected Config: %v", cmp.Diff(tt.amConfig, amConfig, opts...))
			}
		})
	}
}

func createPostableApiReceiver(uid string, name string, integrationNames []string) *apimodels.PostableApiReceiver {
	integrations := make([]*apimodels.PostableGrafanaReceiver, 0, len(integrationNames))
	for _, integrationName := range integrationNames {
		integrations = append(integrations, &apimodels.PostableGrafanaReceiver{
			UID:            uid,
			Type:           "email",
			Name:           integrationName,
			Settings:       apimodels.RawMessage("{}"),
			SecureSettings: map[string]string{},
		})
	}
	return &apimodels.PostableApiReceiver{
		Receiver: config.Receiver{
			Name: name,
		},
		PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
			GrafanaManagedReceivers: integrations,
		},
	}
}

func durationPointer(d model.Duration) *model.Duration {
	return &d
}

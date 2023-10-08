package migration

import (
	"context"
	"encoding/base64"
	"encoding/json"
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
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestFilterReceiversForAlert(t *testing.T) {
	tc := []struct {
		name             string
		channelIds       []migrationStore.UidOrID
		receivers        map[migrationStore.UidOrID]*apimodels.PostableApiReceiver
		defaultReceivers map[string]struct{}
		expected         map[string]any
	}{
		{
			name:       "when an alert has multiple channels, each should filter for the correct receiver",
			channelIds: []migrationStore.UidOrID{"uid1", "uid2"},
			receivers: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				"uid1": createPostableApiReceiver("recv1", nil),
				"uid2": createPostableApiReceiver("recv2", nil),
				"uid3": createPostableApiReceiver("recv3", nil),
			},
			defaultReceivers: map[string]struct{}{},
			expected: map[string]any{
				"recv1": struct{}{},
				"recv2": struct{}{},
			},
		},
		{
			name:       "when default receivers exist, they should be added to an alert's filtered receivers",
			channelIds: []migrationStore.UidOrID{"uid1"},
			receivers: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				"uid1": createPostableApiReceiver("recv1", nil),
				"uid2": createPostableApiReceiver("recv2", nil),
				"uid3": createPostableApiReceiver("recv3", nil),
			},
			defaultReceivers: map[string]struct{}{
				"recv2": {},
			},
			expected: map[string]any{
				"recv1": struct{}{}, // From alert
				"recv2": struct{}{}, // From default
			},
		},
		{
			name:       "when an alert has a channels associated by ID instead of UID, it should be included",
			channelIds: []migrationStore.UidOrID{int64(42)},
			receivers: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				int64(42): createPostableApiReceiver("recv1", nil),
			},
			defaultReceivers: map[string]struct{}{},
			expected: map[string]any{
				"recv1": struct{}{},
			},
		},
		{
			name:       "when an alert's receivers are covered by the defaults, return nil to use default receiver downstream",
			channelIds: []migrationStore.UidOrID{"uid1"},
			receivers: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				"uid1": createPostableApiReceiver("recv1", nil),
				"uid2": createPostableApiReceiver("recv2", nil),
				"uid3": createPostableApiReceiver("recv3", nil),
			},
			defaultReceivers: map[string]struct{}{
				"recv1": {},
				"recv2": {},
			},
			expected: nil, // recv1 is already a default
		},
	}

	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			res := m.filterReceiversForAlert("", tt.channelIds, tt.receivers, tt.defaultReceivers)

			require.Equal(t, tt.expected, res)
		})
	}
}

func TestCreateRoute(t *testing.T) {
	tc := []struct {
		name     string
		channel  *legacymodels.AlertNotification
		recv     *apimodels.PostableApiReceiver
		expected *apimodels.Route
	}{
		{
			name:    "when a receiver is passed in, the route should regex match based on quoted name with continue=true",
			channel: &legacymodels.AlertNotification{},
			recv:    createPostableApiReceiver("recv1", nil),
			expected: &apimodels.Route{
				Receiver:       "recv1",
				ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"recv1".*`}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
		{
			name:    "notification channel should be escaped for regex in the matcher",
			channel: &legacymodels.AlertNotification{},
			recv:    createPostableApiReceiver(`. ^ $ * + - ? ( ) [ ] { } \ |`, nil),
			expected: &apimodels.Route{
				Receiver:       `. ^ $ * + - ? ( ) [ ] { } \ |`,
				ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"\. \^ \$ \* \+ - \? \( \) \[ \] \{ \} \\ \|".*`}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
		{
			name:    "when a channel has sendReminder=true, the route should use the frequency in repeat interval",
			channel: &legacymodels.AlertNotification{SendReminder: true, Frequency: time.Duration(42) * time.Hour},
			recv:    createPostableApiReceiver("recv1", nil),
			expected: &apimodels.Route{
				Receiver:       "recv1",
				ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"recv1".*`}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(model.Duration(time.Duration(42) * time.Hour)),
			},
		},
		{
			name:    "when a channel has sendReminder=false, the route should ignore the frequency in repeat interval and use DisabledRepeatInterval",
			channel: &legacymodels.AlertNotification{SendReminder: false, Frequency: time.Duration(42) * time.Hour},
			recv:    createPostableApiReceiver("recv1", nil),
			expected: &apimodels.Route{
				Receiver:       "recv1",
				ObjectMatchers: apimodels.ObjectMatchers{{Type: 2, Name: ContactLabel, Value: `.*"recv1".*`}},
				Routes:         nil,
				Continue:       true,
				GroupByStr:     nil,
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			res, err := createRoute(channelReceiver{
				channel:  tt.channel,
				receiver: tt.recv,
			})
			require.NoError(t, err)

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

func createNotChannel(t *testing.T, uid string, id int64, name string) *legacymodels.AlertNotification {
	t.Helper()
	return &legacymodels.AlertNotification{UID: uid, ID: id, Name: name, Settings: simplejson.New()}
}

func createNotChannelWithReminder(t *testing.T, uid string, id int64, name string, frequency time.Duration) *legacymodels.AlertNotification {
	t.Helper()
	return &legacymodels.AlertNotification{UID: uid, ID: id, Name: name, SendReminder: true, Frequency: frequency, Settings: simplejson.New()}
}

func TestCreateReceivers(t *testing.T) {
	tc := []struct {
		name            string
		allChannels     []*legacymodels.AlertNotification
		defaultChannels []*legacymodels.AlertNotification
		expRecvMap      map[migrationStore.UidOrID]*apimodels.PostableApiReceiver
		expRecv         []channelReceiver
		expErr          error
	}{
		{
			name:        "when given notification channels migrate them to receivers",
			allChannels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
			expRecvMap: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				"uid1":   createPostableApiReceiver("name1", []string{"name1"}),
				"uid2":   createPostableApiReceiver("name2", []string{"name2"}),
				int64(1): createPostableApiReceiver("name1", []string{"name1"}),
				int64(2): createPostableApiReceiver("name2", []string{"name2"}),
			},
			expRecv: []channelReceiver{
				{
					channel:  createNotChannel(t, "uid1", int64(1), "name1"),
					receiver: createPostableApiReceiver("name1", []string{"name1"}),
				},
				{
					channel:  createNotChannel(t, "uid2", int64(2), "name2"),
					receiver: createPostableApiReceiver("name2", []string{"name2"}),
				},
			},
		},
		{
			name:        "when given notification channel contains double quote sanitize with underscore",
			allChannels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "name\"1")},
			expRecvMap: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				"uid1":   createPostableApiReceiver("name_1", []string{"name_1"}),
				int64(1): createPostableApiReceiver("name_1", []string{"name_1"}),
			},
			expRecv: []channelReceiver{
				{
					channel:  createNotChannel(t, "uid1", int64(1), "name\"1"),
					receiver: createPostableApiReceiver("name_1", []string{"name_1"}),
				},
			},
		},
		{
			name:        "when given notification channels collide after sanitization add short hash to end",
			allChannels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "name\"1"), createNotChannel(t, "uid2", int64(2), "name_1")},
			expRecvMap: map[migrationStore.UidOrID]*apimodels.PostableApiReceiver{
				"uid1":   createPostableApiReceiver("name_1", []string{"name_1"}),
				"uid2":   createPostableApiReceiver("name_1_dba13d", []string{"name_1_dba13d"}),
				int64(1): createPostableApiReceiver("name_1", []string{"name_1"}),
				int64(2): createPostableApiReceiver("name_1_dba13d", []string{"name_1_dba13d"}),
			},
			expRecv: []channelReceiver{
				{
					channel:  createNotChannel(t, "uid1", int64(1), "name\"1"),
					receiver: createPostableApiReceiver("name_1", []string{"name_1"}),
				},
				{
					channel:  createNotChannel(t, "uid2", int64(2), "name_1"),
					receiver: createPostableApiReceiver("name_1_dba13d", []string{"name_1_dba13d"}),
				},
			},
		},
	}

	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			recvMap, recvs, err := m.createReceivers(tt.allChannels)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}

			require.NoError(t, err)

			// We ignore certain fields for the purposes of this test
			for _, recv := range recvs {
				for _, not := range recv.receiver.GrafanaManagedReceivers {
					not.UID = ""
					not.Settings = nil
					not.SecureSettings = nil
				}
			}

			require.Equal(t, tt.expRecvMap, recvMap)
			require.ElementsMatch(t, tt.expRecv, recvs)
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

func TestCreateDefaultRouteAndReceiver(t *testing.T) {
	tc := []struct {
		name            string
		amConfig        *apimodels.PostableUserConfig
		defaultChannels []*legacymodels.AlertNotification
		expRecv         *apimodels.PostableApiReceiver
		expRoute        *apimodels.Route
		expErr          error
	}{
		{
			name:            "when given multiple default notification channels migrate them to a single receiver",
			defaultChannels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
			expRecv:         createPostableApiReceiver("autogen-contact-point-default", []string{"name1", "name2"}),
			expRoute: &apimodels.Route{
				Receiver:       "autogen-contact-point-default",
				Routes:         make([]*apimodels.Route, 0),
				GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
		{
			name: "when given multiple default notification channels migrate them to a single receiver with RepeatInterval set to be the minimum of all channel frequencies",
			defaultChannels: []*legacymodels.AlertNotification{
				createNotChannelWithReminder(t, "uid1", int64(1), "name1", time.Duration(42)),
				createNotChannelWithReminder(t, "uid2", int64(2), "name2", time.Duration(100000)),
			},
			expRecv: createPostableApiReceiver("autogen-contact-point-default", []string{"name1", "name2"}),
			expRoute: &apimodels.Route{
				Receiver:       "autogen-contact-point-default",
				Routes:         make([]*apimodels.Route, 0),
				GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
				RepeatInterval: durationPointer(model.Duration(42)),
			},
		},
		{
			name:            "when given no default notification channels create a single empty receiver for default",
			defaultChannels: []*legacymodels.AlertNotification{},
			expRecv:         createPostableApiReceiver("autogen-contact-point-default", nil),
			expRoute: &apimodels.Route{
				Receiver:       "autogen-contact-point-default",
				Routes:         make([]*apimodels.Route, 0),
				GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
				RepeatInterval: nil,
			},
		},
		{
			name:            "when given a single default notification channels don't create a new default receiver",
			defaultChannels: []*legacymodels.AlertNotification{createNotChannel(t, "uid1", int64(1), "name1")},
			expRecv:         nil,
			expRoute: &apimodels.Route{
				Receiver:       "name1",
				Routes:         make([]*apimodels.Route, 0),
				GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
				RepeatInterval: durationPointer(DisabledRepeatInterval),
			},
		},
		{
			name:            "when given a single default notification channel with SendReminder=true, use the channels Frequency as the RepeatInterval",
			defaultChannels: []*legacymodels.AlertNotification{createNotChannelWithReminder(t, "uid1", int64(1), "name1", time.Duration(42))},
			expRecv:         nil,
			expRoute: &apimodels.Route{
				Receiver:       "name1",
				Routes:         make([]*apimodels.Route, 0),
				GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
				RepeatInterval: durationPointer(model.Duration(42)),
			},
		},
	}

	sqlStore := db.InitTestDB(t)
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			service := NewTestMigrationService(t, sqlStore, nil)
			m := service.newOrgMigration(1)
			recv, route, err := m.createDefaultRouteAndReceiver(tt.defaultChannels)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}

			require.NoError(t, err)

			// We ignore certain fields for the purposes of this test
			if recv != nil {
				for _, not := range recv.GrafanaManagedReceivers {
					not.UID = ""
					not.Settings = nil
					not.SecureSettings = nil
				}
			}

			require.Equal(t, tt.expRecv, recv)
			require.Equal(t, tt.expRoute, route)
		})
	}
}

func createPostableApiReceiver(name string, integrationNames []string) *apimodels.PostableApiReceiver {
	integrations := make([]*apimodels.PostableGrafanaReceiver, 0, len(integrationNames))
	for _, integrationName := range integrationNames {
		integrations = append(integrations, &apimodels.PostableGrafanaReceiver{Name: integrationName})
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

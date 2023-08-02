package migration

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestFilterReceiversForAlert(t *testing.T) {
	tc := []struct {
		name             string
		channelIds       []uidOrID
		receivers        map[uidOrID]*apimodels.PostableApiReceiver
		defaultReceivers map[string]struct{}
		expected         map[string]any
	}{
		{
			name:       "when an alert has multiple channels, each should filter for the correct receiver",
			channelIds: []uidOrID{"uid1", "uid2"},
			receivers: map[uidOrID]*apimodels.PostableApiReceiver{
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
			channelIds: []uidOrID{"uid1"},
			receivers: map[uidOrID]*apimodels.PostableApiReceiver{
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
			channelIds: []uidOrID{int64(42)},
			receivers: map[uidOrID]*apimodels.PostableApiReceiver{
				int64(42): createPostableApiReceiver("recv1", nil),
			},
			defaultReceivers: map[string]struct{}{},
			expected: map[string]any{
				"recv1": struct{}{},
			},
		},
		{
			name:       "when an alert's receivers are covered by the defaults, return nil to use default receiver downstream",
			channelIds: []uidOrID{"uid1"},
			receivers: map[uidOrID]*apimodels.PostableApiReceiver{
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

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMigration(t)
			res := m.filterReceiversForAlert("", tt.channelIds, tt.receivers, tt.defaultReceivers)

			require.Equal(t, tt.expected, res)
		})
	}
}

func TestCreateRoute(t *testing.T) {
	tc := []struct {
		name     string
		channel  *notificationChannel
		recv     *apimodels.PostableApiReceiver
		expected *apimodels.Route
	}{
		{
			name:    "when a receiver is passed in, the route should regex match based on quoted name with continue=true",
			channel: &notificationChannel{},
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
			channel: &notificationChannel{},
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
			channel: &notificationChannel{SendReminder: true, Frequency: model.Duration(time.Duration(42) * time.Hour)},
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
			channel: &notificationChannel{SendReminder: false, Frequency: model.Duration(time.Duration(42) * time.Hour)},
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

func createNotChannel(t *testing.T, uid string, id int64, name string) *notificationChannel {
	t.Helper()
	return &notificationChannel{Uid: uid, ID: id, Name: name, Settings: simplejson.New()}
}

func createNotChannelWithReminder(t *testing.T, uid string, id int64, name string, frequency model.Duration) *notificationChannel {
	t.Helper()
	return &notificationChannel{Uid: uid, ID: id, Name: name, SendReminder: true, Frequency: frequency, Settings: simplejson.New()}
}

func TestCreateReceivers(t *testing.T) {
	tc := []struct {
		name            string
		allChannels     []*notificationChannel
		defaultChannels []*notificationChannel
		expRecvMap      map[uidOrID]*apimodels.PostableApiReceiver
		expRecv         []channelReceiver
		expErr          error
	}{
		{
			name:        "when given notification channels migrate them to receivers",
			allChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
			expRecvMap: map[uidOrID]*apimodels.PostableApiReceiver{
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
			allChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name\"1")},
			expRecvMap: map[uidOrID]*apimodels.PostableApiReceiver{
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
			allChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name\"1"), createNotChannel(t, "uid2", int64(2), "name_1")},
			expRecvMap: map[uidOrID]*apimodels.PostableApiReceiver{
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

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMigration(t)
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

func TestCreateDefaultRouteAndReceiver(t *testing.T) {
	tc := []struct {
		name            string
		amConfig        *apimodels.PostableUserConfig
		defaultChannels []*notificationChannel
		expRecv         *apimodels.PostableApiReceiver
		expRoute        *apimodels.Route
		expErr          error
	}{
		{
			name:            "when given multiple default notification channels migrate them to a single receiver",
			defaultChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
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
			defaultChannels: []*notificationChannel{
				createNotChannelWithReminder(t, "uid1", int64(1), "name1", model.Duration(42)),
				createNotChannelWithReminder(t, "uid2", int64(2), "name2", model.Duration(100000)),
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
			defaultChannels: []*notificationChannel{},
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
			defaultChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1")},
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
			defaultChannels: []*notificationChannel{createNotChannelWithReminder(t, "uid1", int64(1), "name1", model.Duration(42))},
			expRecv:         nil,
			expRoute: &apimodels.Route{
				Receiver:       "name1",
				Routes:         make([]*apimodels.Route, 0),
				GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel},
				RepeatInterval: durationPointer(model.Duration(42)),
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMigration(t)
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

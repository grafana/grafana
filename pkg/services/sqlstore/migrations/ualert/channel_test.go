package ualert

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"

	"github.com/stretchr/testify/require"
)

func TestFilterReceiversForAlert(t *testing.T) {
	tc := []struct {
		name             string
		da               dashAlert
		receivers        map[uidOrID]*PostableApiReceiver
		defaultReceivers map[string]struct{}
		expected         map[string]interface{}
		expErr           error
	}{
		{
			name: "when an alert has multiple channels, each should filter for the correct receiver",
			da: dashAlert{
				ParsedSettings: &dashAlertSettings{
					Notifications: []dashAlertNot{{UID: "uid1"}, {UID: "uid2"}},
				},
			},
			receivers: map[uidOrID]*PostableApiReceiver{
				"uid1": {
					Name:                    "recv1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
				"uid2": {
					Name:                    "recv2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
				"uid3": {
					Name:                    "recv3",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
			},
			defaultReceivers: map[string]struct{}{},
			expected: map[string]interface{}{
				"recv1": struct{}{},
				"recv2": struct{}{},
			},
		},
		{
			name: "when default receivers exist, they should be added to an alert's filtered receivers",
			da: dashAlert{
				ParsedSettings: &dashAlertSettings{
					Notifications: []dashAlertNot{{UID: "uid1"}},
				},
			},
			receivers: map[uidOrID]*PostableApiReceiver{
				"uid1": {
					Name:                    "recv1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
				"uid2": {
					Name:                    "recv2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
				"uid3": {
					Name:                    "recv3",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
			},
			defaultReceivers: map[string]struct{}{
				"recv2": {},
			},
			expected: map[string]interface{}{
				"recv1": struct{}{}, // From alert
				"recv2": struct{}{}, // From default
			},
		},
		{
			name: "when an alert has a channels associated by ID instead of UID, it should be included",
			da: dashAlert{
				ParsedSettings: &dashAlertSettings{
					Notifications: []dashAlertNot{{ID: int64(42)}},
				},
			},
			receivers: map[uidOrID]*PostableApiReceiver{
				int64(42): {
					Name:                    "recv1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
			},
			defaultReceivers: map[string]struct{}{},
			expected: map[string]interface{}{
				"recv1": struct{}{},
			},
		},
		{
			name: "when an alert's receivers are covered by the defaults, return nil to use default receiver downstream",
			da: dashAlert{
				ParsedSettings: &dashAlertSettings{
					Notifications: []dashAlertNot{{UID: "uid1"}},
				},
			},
			receivers: map[uidOrID]*PostableApiReceiver{
				"uid1": {
					Name:                    "recv1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
				"uid2": {
					Name:                    "recv2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
				"uid3": {
					Name:                    "recv3",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
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
			res, err := m.filterReceiversForAlert(tt.da, tt.receivers, tt.defaultReceivers)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected, res)
		})
	}
}

func TestCreateRoute(t *testing.T) {
	tc := []struct {
		name                  string
		ruleUID               string
		filteredReceiverNames map[string]interface{}
		expected              *Route
		expErr                error
	}{
		{
			name:    "when a single receiver is passed in, the route should be simple and not nested",
			ruleUID: "r_uid1",
			filteredReceiverNames: map[string]interface{}{
				"recv1": struct{}{},
			},
			expected: &Route{
				Receiver:   "recv1",
				Matchers:   Matchers{{Type: 0, Name: "rule_uid", Value: "r_uid1"}},
				Routes:     nil,
				Continue:   false,
				GroupByStr: nil,
			},
		},
		{
			name:    "when multiple receivers are passed in, the route should be nested with continue=true",
			ruleUID: "r_uid1",
			filteredReceiverNames: map[string]interface{}{
				"recv1": struct{}{},
				"recv2": struct{}{},
			},
			expected: &Route{
				Receiver: "",
				Matchers: Matchers{{Type: 0, Name: "rule_uid", Value: "r_uid1"}},
				Routes: []*Route{
					{
						Receiver:   "recv1",
						Matchers:   Matchers{{Type: 0, Name: "rule_uid", Value: "r_uid1"}},
						Routes:     nil,
						Continue:   true,
						GroupByStr: nil,
					},
					{
						Receiver:   "recv2",
						Matchers:   Matchers{{Type: 0, Name: "rule_uid", Value: "r_uid1"}},
						Routes:     nil,
						Continue:   true,
						GroupByStr: nil,
					},
				},
				Continue:   false,
				GroupByStr: nil,
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMigration(t)
			res, err := m.createRoute(tt.ruleUID, tt.filteredReceiverNames)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected, res)
		})
	}
}

func createNotChannel(t *testing.T, uid string, id int64, name string) *notificationChannel {
	t.Helper()
	return &notificationChannel{Uid: uid, ID: id, Name: name, Settings: simplejson.New()}
}

func TestCreateReceivers(t *testing.T) {
	tc := []struct {
		name                 string
		amConfig             *PostableUserConfig
		allChannels          []*notificationChannel
		defaultChannels      []*notificationChannel
		expected             map[uidOrID]*PostableApiReceiver
		expAmConfigReceivers []*PostableApiReceiver
		expErr               error
	}{
		{
			name: "when given notification channels migrate them to receivers and add them to amConfig",
			amConfig: &PostableUserConfig{
				AlertmanagerConfig: PostableApiAlertingConfig{
					Receivers: make([]*PostableApiReceiver, 0),
				},
			},
			allChannels:     []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
			defaultChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1")},
			expected: map[uidOrID]*PostableApiReceiver{
				"uid1": {
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				"uid2": {
					Name:                    "name2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name2"}},
				},
				int64(1): {
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				int64(2): {
					Name:                    "name2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name2"}},
				},
			},
			expAmConfigReceivers: []*PostableApiReceiver{
				{
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				{
					Name:                    "name2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name2"}},
				},
			},
		},
		{
			name: "when given multiple default notification channels migrate them to a single receiver",
			amConfig: &PostableUserConfig{
				AlertmanagerConfig: PostableApiAlertingConfig{
					Receivers: make([]*PostableApiReceiver, 0),
				},
			},
			allChannels:     []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
			defaultChannels: []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1"), createNotChannel(t, "uid2", int64(2), "name2")},
			expected: map[uidOrID]*PostableApiReceiver{
				"uid1": {
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				"uid2": {
					Name:                    "name2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name2"}},
				},
				int64(1): {
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				int64(2): {
					Name:                    "name2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name2"}},
				},
			},
			expAmConfigReceivers: []*PostableApiReceiver{
				{
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				{
					Name:                    "name2",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name2"}},
				},
				{
					Name:                    "autogen-contact-point-default",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}, {Name: "name2"}},
				},
			},
		},
		{
			name: "when given no default notification channels create a single empty receiver for default",
			amConfig: &PostableUserConfig{
				AlertmanagerConfig: PostableApiAlertingConfig{
					Receivers: make([]*PostableApiReceiver, 0),
				},
			},
			allChannels:     []*notificationChannel{createNotChannel(t, "uid1", int64(1), "name1")},
			defaultChannels: []*notificationChannel{},
			expected: map[uidOrID]*PostableApiReceiver{
				"uid1": {
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				int64(1): {
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
			},
			expAmConfigReceivers: []*PostableApiReceiver{
				{
					Name:                    "name1",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{{Name: "name1"}},
				},
				{
					Name:                    "autogen-contact-point-default",
					GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
				},
			},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			m := newTestMigration(t)
			res, err := m.createReceivers(tt.amConfig, tt.allChannels, tt.defaultChannels)
			if tt.expErr != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expErr.Error())
				return
			}

			require.NoError(t, err)

			// We ignore certain fields for the purposes of this test
			for _, uidOrID := range tt.amConfig.AlertmanagerConfig.Receivers {
				for _, recv := range uidOrID.GrafanaManagedReceivers {
					recv.UID = ""
					recv.Settings = nil
					recv.SecureSettings = nil
				}
			}

			require.Equal(t, tt.expected, res)
			require.Equal(t, tt.expAmConfigReceivers, tt.amConfig.AlertmanagerConfig.Receivers)
		})
	}
}

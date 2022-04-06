package ualert

import (
	"encoding/base64"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/alertmanager/pkg/labels"
)

type notificationChannel struct {
	ID                    int64            `xorm:"id"`
	OrgID                 int64            `xorm:"org_id"`
	Uid                   string           `xorm:"uid"`
	Name                  string           `xorm:"name"`
	Type                  string           `xorm:"type"`
	DisableResolveMessage bool             `xorm:"disable_resolve_message"`
	IsDefault             bool             `xorm:"is_default"`
	Settings              *simplejson.Json `xorm:"settings"`
	SecureSettings        SecureJsonData   `xorm:"secure_settings"`
}

// channelsPerOrg maps notification channels per organisation
type channelsPerOrg map[int64][]*notificationChannel

// channelMap maps notification channels per organisation
type defaultChannelsPerOrg map[int64][]*notificationChannel

// uidOrID contains both uid -> receiver and ID -> receiver
type uidOrID interface{}

// setupAlertmanagerConfigs starts channel and alert migrations. This creates Alertmanager configs as well as migrates receivers and creates the initial root-level route.
// Returns per org maps containing: The alertmanager config, all migrated receivers, all migrated default receivers
func (m *migration) setupAlertmanagerConfigs() (amConfigsPerOrg, map[int64]map[uidOrID]*PostableApiReceiver, map[int64]map[string]struct{}, error) {
	// allChannels: channelUID -> channelConfig
	allChannelsPerOrg, defaultChannelsPerOrg, err := m.getNotificationChannelMap()
	if err != nil {
		return nil, nil, nil, err
	}

	amConfigPerOrg := make(amConfigsPerOrg, len(allChannelsPerOrg))
	receiversPerOrg := make(map[int64]map[uidOrID]*PostableApiReceiver, len(allChannelsPerOrg))
	defaultReceiversPerOrg := make(map[int64]map[string]struct{}, len(allChannelsPerOrg))
	for orgID := range allChannelsPerOrg {
		amConfig, ok := amConfigPerOrg[orgID]
		if !ok {
			amConfig = &PostableUserConfig{
				AlertmanagerConfig: PostableApiAlertingConfig{
					Receivers: make([]*PostableApiReceiver, 0),
				},
			}
			amConfigPerOrg[orgID] = amConfig
		}

		defaultChannels := defaultChannelsPerOrg[orgID]
		defaultReceiversPerOrg[orgID] = make(map[string]struct{})
		for _, c := range defaultChannels {
			defaultReceiversPerOrg[orgID][c.Name] = struct{}{}
		}

		// Create all new receivers and add to amConfig.
		receivers, err := m.createReceivers(amConfig, allChannelsPerOrg[orgID], defaultChannels)
		if err != nil {
			return nil, nil, nil, err
		}
		receiversPerOrg[orgID] = receivers

		amConfig.AlertmanagerConfig.Route = createDefaultRoute(defaultChannels)
	}

	return amConfigPerOrg, receiversPerOrg, defaultReceiversPerOrg, nil
}

func (m *migration) getNotificationChannelMap() (channelsPerOrg, defaultChannelsPerOrg, error) {
	q := `
	SELECT id,
		org_id,
		uid,
		name,
		type,
		disable_resolve_message,
		is_default,
		settings,
		secure_settings
	FROM
		alert_notification
	`
	allChannels := []notificationChannel{}
	err := m.sess.SQL(q).Find(&allChannels)
	if err != nil {
		return nil, nil, err
	}

	if len(allChannels) == 0 {
		return nil, nil, nil
	}

	allChannelsMap := make(channelsPerOrg)
	defaultChannelsMap := make(defaultChannelsPerOrg)
	for i, c := range allChannels {
		allChannelsMap[c.OrgID] = append(allChannelsMap[c.OrgID], &allChannels[i])

		if c.IsDefault {
			defaultChannelsMap[c.OrgID] = append(defaultChannelsMap[c.OrgID], &allChannels[i])
		}
	}

	return allChannelsMap, defaultChannelsMap, nil
}

func (m *migration) createNotifier(c *notificationChannel) (*PostableGrafanaReceiver, error) {
	if c.Type == "hipchat" || c.Type == "sensu" {
		m.mg.Logger.Error("alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.Uid)
		return nil, nil
	}

	uid, ok := m.generateChannelUID()
	if !ok {
		return nil, errors.New("failed to generate UID for notification channel")
	}

	settings, decryptedSecureSettings, err := migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
	if err != nil {
		return nil, err
	}

	return &PostableGrafanaReceiver{
		UID:                   uid,
		Name:                  c.Name,
		Type:                  c.Type,
		DisableResolveMessage: c.DisableResolveMessage,
		Settings:              settings,
		SecureSettings:        decryptedSecureSettings,
	}, nil
}

// Create one receiver for every unique notification channel. If there are multiple existing default notification channels, these will be stored in a separate receiver
// containing them all to be used only on the root-level route. This is to simplify the structure of the migrated routes  as we are currently limited to one receiver per route,
// so nesting the root-level route will require a significantly more complex setup.
func (m *migration) createReceivers(amConfig *PostableUserConfig, allChannels []*notificationChannel, defaultChannels []*notificationChannel) (map[uidOrID]*PostableApiReceiver, error) {
	receivers := make(map[uidOrID]*PostableApiReceiver)
	for _, c := range allChannels {
		notifier, err := m.createNotifier(c)
		if err != nil {
			return nil, err
		}

		recv := &PostableApiReceiver{
			Name:                    c.Name, // Channel name is unique within an Org
			GrafanaManagedReceivers: []*PostableGrafanaReceiver{notifier},
		}

		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, recv)

		// Store receivers for creating routes from alert rules later.
		if c.Uid != "" {
			receivers[c.Uid] = recv
		}
		if c.ID != 0 {
			// In certain circumstances, the alert rule uses ID instead of uid. So, we add this to be able to lookup by ID in case.
			receivers[c.ID] = recv
		}
	}

	if len(defaultChannels) != 1 {
		// If there are zero or more than one default channels we create a separate contact group that is used only in the root policy. This is to simplify the migrated notification policy structure.
		// If we ever allow more than one receiver per route this won't be necessary
		defaultReceiver := &PostableApiReceiver{
			Name:                    "autogen-contact-point-default",
			GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
		}

		for _, c := range defaultChannels {
			// Need to create a new notifier to prevent uid conflict.
			defaultNotifier, err := m.createNotifier(c)
			if err != nil {
				return nil, err
			}

			defaultReceiver.GrafanaManagedReceivers = append(defaultReceiver.GrafanaManagedReceivers, defaultNotifier)
		}

		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, defaultReceiver)
	}

	return receivers, nil
}

// Create the root-level route with the default receiver
func createDefaultRoute(defaultChannels []*notificationChannel) *Route {
	defaultReceiverName := "autogen-contact-point-default"
	if len(defaultChannels) == 1 {
		// If there is only a single default channel, we don't need a separate receiver to hold it. We can reuse the existing receiver for that single notifier.
		defaultReceiverName = defaultChannels[0].Name
	}

	return &Route{
		Receiver:   defaultReceiverName,
		Routes:     make([]*Route, 0),
		GroupByStr: []string{"..."}, // Root policy should have grouping disabled (group by all) to keep parity with pre-migration notifications
	}
}

// Wrapper to select receivers for given alert rules based on associated notification channels and then create the migrated route
func (m *migration) createRouteForAlert(ruleUID string, da dashAlert, receivers map[uidOrID]*PostableApiReceiver, defaultReceivers map[string]struct{}) (*Route, error) {
	// Create route(s) for alert
	filteredReceiverNames, err := m.filterReceiversForAlert(da, receivers, defaultReceivers)
	if err != nil {
		return nil, err
	}

	if len(filteredReceiverNames) != 0 {
		// Only create a route if there are specific receivers, otherwise it defaults to the root-level route
		route, err := m.createRoute(ruleUID, filteredReceiverNames)
		if err != nil {
			return nil, err
		}

		return route, nil
	}

	return nil, nil
}

// Create route(s) for the given alert ruleUID and receivers.
// If the alert had a single channel, it will now have a single route/policy. If the alert had multiple channels, it will now have multiple nested routes/policies.
func (m *migration) createRoute(ruleUID string, filteredReceiverNames map[string]interface{}) (*Route, error) {
	n, v := getLabelForRouteMatching(ruleUID)
	mat, err := labels.NewMatcher(labels.MatchEqual, n, v)
	if err != nil {
		return nil, err
	}

	var route *Route
	if len(filteredReceiverNames) == 1 {
		for name := range filteredReceiverNames {
			route = &Route{
				Receiver: name,
				Matchers: Matchers{mat},
			}
		}
	} else {
		nestedRoutes := []*Route{}
		for name := range filteredReceiverNames {
			r := &Route{
				Receiver: name,
				Matchers: Matchers{mat},
				Continue: true,
			}
			nestedRoutes = append(nestedRoutes, r)
		}

		route = &Route{
			Matchers: Matchers{mat},
			Routes:   nestedRoutes,
		}
	}

	return route, nil
}

// Filter receivers to select those that were associated to the given rule as channels.
func (m *migration) filterReceiversForAlert(da dashAlert, receivers map[uidOrID]*PostableApiReceiver, defaultReceivers map[string]struct{}) (map[string]interface{}, error) {
	channelIDs := extractChannelIDs(da)
	if len(channelIDs) == 0 {
		// If there are no channels associated, we use the default route.
		return nil, nil
	}

	// Filter receiver names
	filteredReceiverNames := make(map[string]interface{})
	for _, uidOrId := range channelIDs {
		recv, ok := receivers[uidOrId]
		if ok {
			filteredReceiverNames[recv.Name] = struct{}{} // Deduplicate on contact point name
		} else {
			m.mg.Logger.Warn("ignoring obsolete notification channel", "uid", uidOrId)
		}
	}

	coveredByDefault := func(names map[string]interface{}) bool {
		// Check if all receivers are also default ones and if so, just use the default route.
		for n := range names {
			if _, ok := defaultReceivers[n]; !ok {
				return false
			}
		}
		return true
	}

	if len(filteredReceiverNames) == 0 || coveredByDefault(filteredReceiverNames) {
		// Use the default route instead.
		return nil, nil
	}

	// Add default receivers alongside rule-specific ones
	for n := range defaultReceivers {
		filteredReceiverNames[n] = struct{}{}
	}

	return filteredReceiverNames, nil
}

func (m *migration) generateChannelUID() (string, bool) {
	for i := 0; i < 5; i++ {
		gen := util.GenerateShortUID()
		if _, ok := m.seenChannelUIDs[gen]; !ok {
			m.seenChannelUIDs[gen] = struct{}{}
			return gen, true
		}
	}

	return "", false
}

// Some settings were migrated from settings to secure settings in between.
// See https://grafana.com/docs/grafana/latest/installation/upgrading/#ensure-encryption-of-existing-alert-notification-channel-secrets.
// migrateSettingsToSecureSettings takes care of that.
func migrateSettingsToSecureSettings(chanType string, settings *simplejson.Json, secureSettings SecureJsonData) (*simplejson.Json, map[string]string, error) {
	keys := []string{}
	switch chanType {
	case "slack":
		keys = []string{"url", "token"}
	case "pagerduty":
		keys = []string{"integrationKey"}
	case "webhook":
		keys = []string{"password"}
	case "prometheus-alertmanager":
		keys = []string{"basicAuthPassword"}
	case "opsgenie":
		keys = []string{"apiKey"}
	case "telegram":
		keys = []string{"bottoken"}
	case "line":
		keys = []string{"token"}
	case "pushover":
		keys = []string{"apiToken", "userKey"}
	case "threema":
		keys = []string{"api_secret"}
	}

	decryptedSecureSettings := secureSettings.Decrypt()
	cloneSettings := simplejson.New()
	settingsMap, err := settings.Map()
	if err != nil {
		return nil, nil, err
	}
	for k, v := range settingsMap {
		cloneSettings.Set(k, v)
	}
	for _, k := range keys {
		if v, ok := decryptedSecureSettings[k]; ok && v != "" {
			continue
		}

		sv := cloneSettings.Get(k).MustString()
		if sv != "" {
			decryptedSecureSettings[k] = sv
			cloneSettings.Del(k)
		}
	}

	return cloneSettings, decryptedSecureSettings, nil
}

func getLabelForRouteMatching(ruleUID string) (string, string) {
	return "rule_uid", ruleUID
}

func extractChannelIDs(d dashAlert) (channelUids []interface{}) {
	// Extracting channel UID/ID.
	for _, ui := range d.ParsedSettings.Notifications {
		if ui.UID != "" {
			channelUids = append(channelUids, ui.UID)
			continue
		}
		// In certain circumstances, id is used instead of uid.
		// We add this if there was no uid.
		if ui.ID > 0 {
			channelUids = append(channelUids, ui.ID)
		}
	}

	return channelUids
}

// Below is a snapshot of all the config and supporting functions imported
// to avoid vendoring those packages.

type PostableUserConfig struct {
	TemplateFiles      map[string]string         `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig PostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
}

type amConfigsPerOrg = map[int64]*PostableUserConfig

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

type PostableApiAlertingConfig struct {
	Route     *Route                 `yaml:"route,omitempty" json:"route,omitempty"`
	Templates []string               `yaml:"templates" json:"templates"`
	Receivers []*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type Route struct {
	Receiver   string   `yaml:"receiver,omitempty" json:"receiver,omitempty"`
	Matchers   Matchers `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	Routes     []*Route `yaml:"routes,omitempty" json:"routes,omitempty"`
	Continue   bool     `yaml:"continue,omitempty" json:"continue,omitempty"`
	GroupByStr []string `yaml:"group_by,omitempty" json:"group_by,omitempty"`
}

type Matchers labels.Matchers

func (m Matchers) MarshalJSON() ([]byte, error) {
	if len(m) == 0 {
		return nil, nil
	}
	result := make([]string, len(m))
	for i, matcher := range m {
		result[i] = matcher.String()
	}
	return json.Marshal(result)
}

type PostableApiReceiver struct {
	Name                    string                     `yaml:"name" json:"name"`
	GrafanaManagedReceivers []*PostableGrafanaReceiver `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}

type PostableGrafanaReceiver CreateAlertNotificationCommand

type CreateAlertNotificationCommand struct {
	UID                   string            `json:"uid"`
	Name                  string            `json:"name"`
	Type                  string            `json:"type"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Settings              *simplejson.Json  `json:"settings"`
	SecureSettings        map[string]string `json:"secureSettings"`
}

package ualert

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type notificationChannel struct {
	ID                    int                           `xorm:"id"`
	Uid                   string                        `xorm:"uid"`
	Name                  string                        `xorm:"name"`
	Type                  string                        `xorm:"type"`
	DisableResolveMessage bool                          `xorm:"disable_resolve_message"`
	IsDefault             bool                          `xorm:"is_default"`
	Settings              *simplejson.Json              `xorm:"settings"`
	SecureSettings        securejsondata.SecureJsonData `xorm:"secure_settings"`
}

func (m *migration) getNotificationChannelMap() (map[interface{}]*notificationChannel, []*notificationChannel, error) {
	q := `
	SELECT id,
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

	allChannelsMap := make(map[interface{}]*notificationChannel)
	var defaultChannels []*notificationChannel
	for i, c := range allChannels {
		if c.Uid != "" {
			allChannelsMap[c.Uid] = &allChannels[i]
		}
		if c.ID != 0 {
			allChannelsMap[c.ID] = &allChannels[i]
		}
		if c.IsDefault {
			// TODO: verify that there will be only 1 default channel.
			defaultChannels = append(defaultChannels, &allChannels[i])
		}
	}

	return allChannelsMap, defaultChannels, nil
}

func (m *migration) updateReceiverAndRoute(allChannels map[interface{}]*notificationChannel, defaultChannels []*notificationChannel, da dashAlert, rule *alertRule, amConfig *PostableUserConfig) error {
	// Create receiver and route for this rule.
	if allChannels == nil {
		return nil
	}

	channelIDs := extractChannelIDs(da)
	if len(channelIDs) == 0 {
		// If there are no channels associated, we skip adding any routes,
		// receivers or labels to rules so that it goes through the default
		// route.
		return nil
	}

	recv, route, err := m.makeReceiverAndRoute(rule.Uid, channelIDs, defaultChannels, allChannels)
	if err != nil {
		return err
	}

	if recv != nil {
		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, recv)
	}
	if route != nil {
		amConfig.AlertmanagerConfig.Route.Routes = append(amConfig.AlertmanagerConfig.Route.Routes, route)
	}

	return nil
}

func (m *migration) makeReceiverAndRoute(ruleUid string, channelUids []interface{}, defaultChannels []*notificationChannel, allChannels map[interface{}]*notificationChannel) (*PostableApiReceiver, *Route, error) {
	portedChannels := []*PostableGrafanaReceiver{}
	var receiver *PostableApiReceiver

	addChannel := func(c *notificationChannel) error {
		if c.Type == "hipchat" || c.Type == "sensu" {
			m.mg.Logger.Error("alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.Uid)
			return nil
		}

		uid, ok := m.generateChannelUID()
		if !ok {
			return errors.New("failed to generate UID for notification channel")
		}

		m.migratedChannels[c] = struct{}{}
		settings, secureSettings := migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
		portedChannels = append(portedChannels, &PostableGrafanaReceiver{
			UID:                   uid,
			Name:                  c.Name,
			Type:                  c.Type,
			DisableResolveMessage: c.DisableResolveMessage,
			Settings:              settings,
			SecureSettings:        secureSettings,
		})

		return nil
	}

	// Remove obsolete notification channels.
	filteredChannelUids := make(map[interface{}]struct{})
	for _, uid := range channelUids {
		_, ok := allChannels[uid]
		if ok {
			filteredChannelUids[uid] = struct{}{}
		} else {
			m.mg.Logger.Warn("ignoring obsolete notification channel", "uid", uid)
		}
	}
	// Add default channels that are not obsolete.
	for _, c := range defaultChannels {
		id := interface{}(c.Uid)
		if c.Uid == "" {
			id = c.ID
		}
		_, ok := allChannels[id]
		if ok {
			filteredChannelUids[id] = struct{}{}
		}
	}

	if len(filteredChannelUids) == 0 && ruleUid != "default_route" {
		// We use the default route instead. No need to add additional route.
		return nil, nil, nil
	}

	chanKey, err := makeKeyForChannelGroup(filteredChannelUids)
	if err != nil {
		return nil, nil, err
	}

	var receiverName string
	if rn, ok := m.portedChannelGroups[chanKey]; ok {
		// We have ported these exact set of channels already. Re-use it.
		receiverName = rn
		if receiverName == "autogen-contact-point-default" {
			// We don't need to create new routes if it's the default contact point.
			return nil, nil, nil
		}
	} else {
		for n := range filteredChannelUids {
			if err := addChannel(allChannels[n]); err != nil {
				return nil, nil, err
			}
		}

		if ruleUid == "default_route" {
			receiverName = "autogen-contact-point-default"
		} else {
			m.lastReceiverID++
			receiverName = fmt.Sprintf("autogen-contact-point-%d", m.lastReceiverID)
		}

		m.portedChannelGroups[chanKey] = receiverName
		receiver = &PostableApiReceiver{
			Name:                    receiverName,
			GrafanaManagedReceivers: portedChannels,
		}
	}

	n, v := getLabelForRouteMatching(ruleUid)
	mat, err := labels.NewMatcher(labels.MatchEqual, n, v)
	if err != nil {
		return nil, nil, err
	}
	route := &Route{
		Receiver: receiverName,
		Matchers: Matchers{mat},
	}

	return receiver, route, nil
}

// makeKeyForChannelGroup generates a unique for this group of channels UIDs.
func makeKeyForChannelGroup(channelUids map[interface{}]struct{}) (string, error) {
	uids := make([]string, 0, len(channelUids))
	for u := range channelUids {
		switch uid := u.(type) {
		case string:
			uids = append(uids, uid)
		case int, int32, int64:
			uids = append(uids, fmt.Sprintf("%d", uid))
		default:
			// Should never happen.
			return "", fmt.Errorf("unknown channel UID type: %T", u)
		}
	}

	sort.Strings(uids)
	return strings.Join(uids, "::sep::"), nil
}

// addDefaultChannels should be called before adding any other routes.
func (m *migration) addDefaultChannels(amConfig *PostableUserConfig, allChannels map[interface{}]*notificationChannel, defaultChannels []*notificationChannel) error {
	// Default route and receiver.
	recv, route, err := m.makeReceiverAndRoute("default_route", nil, defaultChannels, allChannels)
	if err != nil {
		return err
	}

	if recv != nil {
		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, recv)
	}
	if route != nil {
		route.Matchers = nil // Don't need matchers for root route.
		amConfig.AlertmanagerConfig.Route = route
	}

	return nil
}

func (m *migration) addUnmigratedChannels(amConfig *PostableUserConfig, allChannels map[interface{}]*notificationChannel, defaultChannels []*notificationChannel) error {
	// Unmigrated channels.
	portedChannels := []*PostableGrafanaReceiver{}
	receiver := &PostableApiReceiver{
		Name: "autogen-unlinked-channel-recv",
	}
	for _, c := range allChannels {
		_, ok := m.migratedChannels[c]
		if ok {
			continue
		}
		if c.Type == "hipchat" || c.Type == "sensu" {
			m.mg.Logger.Error("alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.Uid)
			continue
		}

		uid, ok := m.generateChannelUID()
		if !ok {
			return errors.New("failed to generate UID for notification channel")
		}

		m.migratedChannels[c] = struct{}{}
		settings, secureSettings := migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
		portedChannels = append(portedChannels, &PostableGrafanaReceiver{
			UID:                   uid,
			Name:                  c.Name,
			Type:                  c.Type,
			DisableResolveMessage: c.DisableResolveMessage,
			Settings:              settings,
			SecureSettings:        secureSettings,
		})
	}
	receiver.GrafanaManagedReceivers = portedChannels
	if len(portedChannels) > 0 {
		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, receiver)
	}

	return nil
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
func migrateSettingsToSecureSettings(chanType string, settings *simplejson.Json, secureSettings securejsondata.SecureJsonData) (*simplejson.Json, map[string]string) {
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

	ss := secureSettings.Decrypt()
	for _, k := range keys {
		if v, ok := ss[k]; ok && v != "" {
			continue
		}

		sv := settings.Get(k).MustString()
		if sv != "" {
			ss[k] = sv
			settings.Del(k)
		}
	}

	return settings, ss
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

func (c *PostableUserConfig) EncryptSecureSettings() error {
	for _, r := range c.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			for k, v := range gr.SecureSettings {
				encryptedData, err := util.Encrypt([]byte(v), setting.SecretKey)
				if err != nil {
					return fmt.Errorf("failed to encrypt secure settings: %w", err)
				}
				gr.SecureSettings[k] = base64.StdEncoding.EncodeToString(encryptedData)
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
	Receiver string   `yaml:"receiver,omitempty" json:"receiver,omitempty"`
	Matchers Matchers `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	Routes   []*Route `yaml:"routes,omitempty" json:"routes,omitempty"`
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

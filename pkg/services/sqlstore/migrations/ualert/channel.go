package ualert

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

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
	rule.Labels["alertname"] = da.Name
	rule.Annotations["message"] = da.Message

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

	// Attach label for routing.
	n, v := getLabelForRouteMatching(rule.Uid)
	rule.Labels[n] = v

	amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, recv)
	amConfig.AlertmanagerConfig.Route.Routes = append(amConfig.AlertmanagerConfig.Route.Routes, route)

	return nil
}

func (m *migration) makeReceiverAndRoute(ruleUid string, channelUids []interface{}, defaultChannels []*notificationChannel, allChannels map[interface{}]*notificationChannel) (*PostableApiReceiver, *Route, error) {
	receiverName := getMigratedReceiverNameFromRuleUID(ruleUid)

	portedChannels := []*PostableGrafanaReceiver{}
	receiver := &PostableApiReceiver{
		Name: receiverName,
	}

	addedChannels := map[*notificationChannel]struct{}{}

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
		addedChannels[c] = struct{}{}

		return nil
	}

	for _, n := range channelUids {
		c, ok := allChannels[n]
		if !ok {
			continue
		}

		if err := addChannel(c); err != nil {
			return nil, nil, err
		}
	}

	for _, c := range defaultChannels {
		if _, ok := addedChannels[c]; !ok {
			if err := addChannel(c); err != nil {
				return nil, nil, err
			}
		}
	}

	receiver.GrafanaManagedReceivers = portedChannels

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

func (m *migration) updateDefaultAndUnmigratedChannels(amConfig *PostableUserConfig, allChannels map[interface{}]*notificationChannel, defaultChannels []*notificationChannel) error {
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

	// Default route and receiver.
	var channelUids = []interface{}{}
	for _, c := range defaultChannels {
		if c.Uid == "" {
			channelUids = append(channelUids, c.ID)
		} else {
			channelUids = append(channelUids, c.Uid)
		}
	}

	recv, route, err := m.makeReceiverAndRoute("default_route", channelUids, defaultChannels, allChannels)
	if err != nil {
		return err
	}

	route.Matchers = nil // Don't need matchers for root route.
	route.Routes = amConfig.AlertmanagerConfig.Route.Routes
	amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, recv)
	amConfig.AlertmanagerConfig.Route = route

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

func getMigratedReceiverNameFromRuleUID(ruleUID string) string {
	return fmt.Sprintf("autogen-panel-recv-%s", ruleUID)
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

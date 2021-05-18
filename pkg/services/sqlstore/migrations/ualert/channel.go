package ualert

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type notificationChannel struct {
	Uid                   string                        `xorm:"uid"`
	Name                  string                        `xorm:"name"`
	Type                  string                        `xorm:"type"`
	DisableResolveMessage bool                          `xorm:"disable_resolve_message"`
	IsDefault             bool                          `xorm:"is_default"`
	Settings              *simplejson.Json              `xorm:"settings"`
	SecureSettings        securejsondata.SecureJsonData `xorm:"secure_settings"`
}

func (m *migration) getNotificationChannelMap() (map[string]*notificationChannel, *notificationChannel, error) {
	q := `
	SELECT uid,
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

	allChannelsMap := make(map[string]*notificationChannel)
	var defaultChannel *notificationChannel
	for i, c := range allChannels {
		allChannelsMap[c.Uid] = &allChannels[i]
		if c.IsDefault {
			// TODO: verify that there will be only 1 default channel.
			defaultChannel = &allChannels[i]
		}
	}

	if defaultChannel == nil {
		// TODO: is this possible?
		defaultChannel = &allChannels[0]
	}

	return allChannelsMap, defaultChannel, nil
}

func (m *migration) makeReceiverAndRoute(ruleUid string, channelUids []string, allChannels map[string]*notificationChannel) (*PostableApiReceiver, *Route, error) {
	receiverName := getMigratedReceiverNameFromRuleUID(ruleUid)

	portedChannels := []*PostableGrafanaReceiver{}
	receiver := &PostableApiReceiver{
		Name: receiverName,
	}

	for _, n := range channelUids {
		m, ok := allChannels[n]
		if !ok {
			// TODO: should we error out here?
			continue
		}
		if m.Type == "hipchat" || m.Type == "sensu" {
			return nil, nil, fmt.Errorf("discontinued notification channel found: %s", m.Type)
		}

		settings, secureSettings := migrateSettingsToSecureSettings(m.Type, m.Settings, m.SecureSettings)
		portedChannels = append(portedChannels, &PostableGrafanaReceiver{
			Name:                  m.Name,
			Type:                  m.Type,
			DisableResolveMessage: m.DisableResolveMessage,
			Settings:              settings,
			SecureSettings:        secureSettings,
		})
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

func extractChannelInfoFromDashboard(d oldDash, panelId int64) (channelUids []string, ruleName string, ruleMessage string, _ error) {
	panels, err := d.Data.Get("panels").Array()
	if err != nil {
		return nil, "", "", err
	}

	for _, pi := range panels {
		p := simplejson.NewFromAny(pi)
		pid, err := p.Get("id").Int64()
		if err != nil {
			return nil, "", "", err
		}

		if pid != panelId {
			continue
		}

		a := p.Get("alert")

		ruleMessage = a.Get("message").MustString()
		ruleName = a.Get("name").MustString()

		// Extracting channel UIDs.
		uids, err := a.Get("notifications").Array()
		if err != nil {
			return nil, "", "", err
		}

		for _, ui := range uids {
			u := simplejson.NewFromAny(ui)
			channelUid, err := u.Get("uid").String()
			if err != nil {
				return nil, "", "", err
			}

			channelUids = append(channelUids, channelUid)
		}

		break
	}

	return channelUids, ruleName, ruleMessage, nil
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
	Name                  string            `json:"name"  binding:"Required"`
	Type                  string            `json:"type"  binding:"Required"`
	DisableResolveMessage bool              `json:"disableResolveMessage"`
	Settings              *simplejson.Json  `json:"settings"`
	SecureSettings        map[string]string `json:"secureSettings"`
}

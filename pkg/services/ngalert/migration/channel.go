package migration

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

const (
	// DisabledRepeatInterval is a large duration that will be used as a pseudo-disable in case a legacy channel doesn't have SendReminders enabled.
	DisabledRepeatInterval = model.Duration(time.Duration(8736) * time.Hour) // 1y
)

// migrateChannels creates Alertmanager configs with migrated receivers and routes.
func (om *OrgMigration) migrateChannels(channels []*legacymodels.AlertNotification) (*migmodels.Alertmanager, error) {
	amConfig := migmodels.NewAlertmanager()
	empty := true
	// Create all newly migrated receivers from legacy notification channels.
	for _, c := range channels {
		if c.Type == "hipchat" || c.Type == "sensu" {
			om.log.Error("Alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.UID)
			continue
		}
		receiver, err := om.createReceiver(c)
		if err != nil {
			return nil, err
		}

		empty = false
		route := createRoute(c, receiver.Name)
		amConfig.AddRoute(route)
		amConfig.AddReceiver(receiver)
	}
	if empty {
		return nil, nil
	}

	return amConfig, nil
}

// validateAlertmanagerConfig validates the alertmanager configuration produced by the migration against the receivers.
func (om *OrgMigration) validateAlertmanagerConfig(config *apimodels.PostableUserConfig) error {
	for _, r := range config.AlertmanagerConfig.Receivers {
		for _, gr := range r.GrafanaManagedReceivers {
			data, err := gr.Settings.MarshalJSON()
			if err != nil {
				return err
			}
			var (
				cfg = &alertingNotify.GrafanaIntegrationConfig{
					UID:                   gr.UID,
					Name:                  gr.Name,
					Type:                  gr.Type,
					DisableResolveMessage: gr.DisableResolveMessage,
					Settings:              data,
					SecureSettings:        gr.SecureSettings,
				}
			)

			_, err = alertingNotify.BuildReceiverConfiguration(context.Background(), &alertingNotify.APIReceiver{
				GrafanaIntegrations: alertingNotify.GrafanaIntegrations{Integrations: []*alertingNotify.GrafanaIntegrationConfig{cfg}},
			}, om.encryptionService.GetDecryptedValue)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// createNotifier creates a PostableGrafanaReceiver from a legacy notification channel.
func (om *OrgMigration) createNotifier(c *legacymodels.AlertNotification) (*apimodels.PostableGrafanaReceiver, error) {
	settings, secureSettings, err := om.migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
	if err != nil {
		return nil, err
	}

	data, err := settings.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return &apimodels.PostableGrafanaReceiver{
		UID:                   c.UID,
		Name:                  c.Name,
		Type:                  c.Type,
		DisableResolveMessage: c.DisableResolveMessage,
		Settings:              data,
		SecureSettings:        secureSettings,
	}, nil
}

// createReceiver creates a receiver from a legacy notification channel.
func (om *OrgMigration) createReceiver(channel *legacymodels.AlertNotification) (*apimodels.PostableApiReceiver, error) {
	notifier, err := om.createNotifier(channel)
	if err != nil {
		return nil, err
	}

	return &apimodels.PostableApiReceiver{
		Receiver: config.Receiver{
			Name: channel.Name, // Channel name is unique within an Org.
		},
		PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
			GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{notifier},
		},
	}, nil
}

// createRoute creates a route from a legacy notification channel, and matches using a label based on the channel UID.
func createRoute(channel *legacymodels.AlertNotification, receiverName string) *apimodels.Route {
	// We create a matchers based on channel UID so that we only need a single route per channel.
	// All routes are stored in a nested route under the root. This is so we can keep the migrated channels separate
	// and organized.
	// The matchers are created using a label that is unique to the channel UID. So, each migrated alert rule can define
	// one label per migrated channel that it should send to.
	// Default channels are matched using a catch-all matcher, because in legacy alerting they are attached to all
	// alerts automatically.
	//
	// For example, if an alert needs to send to channel1 and channel2 it will have two labels:
	// - __contact_channel1__="true"
	// - __contact_channel2__="true"
	//
	// These will match two routes as they are all defined with Continue=true.

	label := fmt.Sprintf(ContactLabelTemplate, channel.UID)
	mat, _ := labels.NewMatcher(labels.MatchEqual, label, "true")

	// If the channel is default, we create a catch-all matcher instead so this always matches.
	if channel.IsDefault {
		mat, _ = labels.NewMatcher(labels.MatchRegexp, model.AlertNameLabel, ".+")
	}

	repeatInterval := DisabledRepeatInterval
	if channel.SendReminder {
		repeatInterval = model.Duration(channel.Frequency)
	}

	return &apimodels.Route{
		Receiver:       receiverName,
		ObjectMatchers: apimodels.ObjectMatchers{mat},
		Continue:       true, // We continue so that each sibling contact point route can separately match.
		RepeatInterval: &repeatInterval,
	}
}

var secureKeysToMigrate = map[string][]string{
	"slack":                   {"url", "token"},
	"pagerduty":               {"integrationKey"},
	"webhook":                 {"password"},
	"prometheus-alertmanager": {"basicAuthPassword"},
	"opsgenie":                {"apiKey"},
	"telegram":                {"bottoken"},
	"line":                    {"token"},
	"pushover":                {"apiToken", "userKey"},
	"threema":                 {"api_secret"},
}

// Some settings were migrated from settings to secure settings in between.
// See https://grafana.com/docs/grafana/latest/installation/upgrading/#ensure-encryption-of-existing-alert-notification-channel-secrets.
// migrateSettingsToSecureSettings takes care of that.
func (om *OrgMigration) migrateSettingsToSecureSettings(chanType string, settings *simplejson.Json, secureSettings SecureJsonData) (*simplejson.Json, map[string]string, error) {
	keys := secureKeysToMigrate[chanType]
	newSecureSettings := secureSettings.Decrypt()
	cloneSettings := simplejson.New()
	settingsMap, err := settings.Map()
	if err != nil {
		return nil, nil, err
	}
	for k, v := range settingsMap {
		cloneSettings.Set(k, v)
	}
	for _, k := range keys {
		if v, ok := newSecureSettings[k]; ok && v != "" {
			continue
		}

		sv := cloneSettings.Get(k).MustString()
		if sv != "" {
			newSecureSettings[k] = sv
			cloneSettings.Del(k)
		}
	}

	err = om.encryptSecureSettings(newSecureSettings)
	if err != nil {
		return nil, nil, err
	}

	return cloneSettings, newSecureSettings, nil
}

func (om *OrgMigration) encryptSecureSettings(secureSettings map[string]string) error {
	for key, value := range secureSettings {
		encryptedData, err := om.encryptionService.Encrypt(context.Background(), []byte(value), secrets.WithoutScope())
		if err != nil {
			return fmt.Errorf("encrypt secure settings: %w", err)
		}
		secureSettings[key] = base64.StdEncoding.EncodeToString(encryptedData)
	}
	return nil
}

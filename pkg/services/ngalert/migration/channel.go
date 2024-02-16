package migration

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

const (
	// DisabledRepeatInterval is a large duration that will be used as a pseudo-disable in case a legacy channel doesn't have SendReminders enabled.
	DisabledRepeatInterval = model.Duration(time.Duration(8736) * time.Hour) // 1y
)

// ErrDiscontinued is used for channels that are no longer supported after migration.
var ErrDiscontinued = errors.New("discontinued")

// migrateChannels creates Alertmanager configs with migrated receivers and routes.
func (om *OrgMigration) migrateChannels(channels []*legacymodels.AlertNotification, log log.Logger) ([]*migmodels.ContactPair, error) {
	// Create all newly migrated receivers from legacy notification channels.
	pairs := make([]*migmodels.ContactPair, 0, len(channels))
	for _, c := range channels {
		l := log.New("type", c.Type, "name", c.Name, "uid", c.UID)
		pair := &migmodels.ContactPair{
			Channel: c,
		}
		receiver, err := om.createReceiver(c)
		if err != nil {
			l.Warn("Failed to create receiver", "error", err)
			pair.Error = err
			pairs = append(pairs, pair)
			continue
		}
		pair.ContactPoint = receiver

		route, err := createRoute(c, receiver.Name)
		if err != nil {
			l.Warn("Failed to create route", "error", err)
			pair.Error = err
			pairs = append(pairs, pair)
			continue
		}
		pair.Route = route
		pairs = append(pairs, pair)
	}

	return pairs, nil
}

// createNotifier creates a PostableGrafanaReceiver from a legacy notification channel.
func (om *OrgMigration) createReceiver(c *legacymodels.AlertNotification) (*apimodels.PostableGrafanaReceiver, error) {
	if c.Type == "hipchat" || c.Type == "sensu" {
		return nil, fmt.Errorf("'%s': %w", c.Type, ErrDiscontinued)
	}
	settings, secureSettings, err := om.migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
	if err != nil {
		return nil, err
	}

	data, err := settings.MarshalJSON()
	if err != nil {
		return nil, err
	}

	recv := &apimodels.PostableGrafanaReceiver{
		UID:                   c.UID,
		Name:                  c.Name,
		Type:                  c.Type,
		DisableResolveMessage: c.DisableResolveMessage,
		Settings:              data,
		SecureSettings:        secureSettings,
	}
	err = validateReceiver(recv, om.encryptionService.GetDecryptedValue)
	if err != nil {
		return nil, err
	}
	return recv, nil
}

// validateReceiver validates a receiver by building the configuration and checking for errors.
func validateReceiver(receiver *apimodels.PostableGrafanaReceiver, decrypt func(ctx context.Context, sjd map[string][]byte, key, fallback string) string) error {
	var (
		cfg = &alertingNotify.GrafanaIntegrationConfig{
			UID:                   receiver.UID,
			Name:                  receiver.Name,
			Type:                  receiver.Type,
			DisableResolveMessage: receiver.DisableResolveMessage,
			Settings:              json.RawMessage(receiver.Settings),
			SecureSettings:        receiver.SecureSettings,
		}
	)

	_, err := alertingNotify.BuildReceiverConfiguration(context.Background(), &alertingNotify.APIReceiver{
		GrafanaIntegrations: alertingNotify.GrafanaIntegrations{Integrations: []*alertingNotify.GrafanaIntegrationConfig{cfg}},
	}, decrypt)
	return err
}

// createRoute creates a route from a legacy notification channel, and matches using a label based on the channel UID.
func createRoute(channel *legacymodels.AlertNotification, receiverName string) (*apimodels.Route, error) {
	// We create a matchers based on channel name so that we only need a single route per channel.
	// All channel routes are nested in a single route under the root. This is so we can keep the migrated channels separate
	// and organized.
	// Since default channels are attached to all alerts in legacy, we use  a catch-all matcher after migration instead
	// of a specific label matcher.
	//
	// For example, if an alert needs to send to channel1 and channel2 it will have one label to route to the nested
	// policy and two channel-specific labels to route to the correct contact points:
	// - __legacy_use_channels__="true"
	// - __legacy_c_channel1__="true"
	// - __legacy_c_channel2__="true"
	//
	// If an alert needs to send to channel1 and the default channel, it will have one label to route to the nested
	// policy and one channel-specific label to route to channel1, and a catch-all policy will ensure it also routes to
	// the default channel.

	label := contactLabel(channel.Name)
	mat, err := labels.NewMatcher(labels.MatchEqual, label, "true")
	if err != nil {
		return nil, err
	}

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
	}, nil
}

// contactLabel creates a label matcher key used to route alerts to a contact point.
func contactLabel(name string) string {
	return ngmodels.MigratedContactLabelPrefix + name + "__"
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
	newSecureSettings := secureSettings.Decrypt(om.cfg.SecretKey)
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

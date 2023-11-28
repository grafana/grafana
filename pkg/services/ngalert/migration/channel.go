package migration

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
)

const (
	// DisabledRepeatInterval is a large duration that will be used as a pseudo-disable in case a legacy channel doesn't have SendReminders enabled.
	DisabledRepeatInterval = model.Duration(time.Duration(8736) * time.Hour) // 1y
)

// channelReceiver is a convenience struct that contains a notificationChannel and its corresponding migrated PostableApiReceiver.
type channelReceiver struct {
	channel  *legacymodels.AlertNotification
	receiver *apimodels.PostableApiReceiver
}

// setupAlertmanagerConfigs creates Alertmanager configs with migrated receivers and routes.
func (om *OrgMigration) migrateChannels(allChannels []*legacymodels.AlertNotification, pairs []*AlertPair) (*apimodels.PostableUserConfig, error) {
	var defaultChannels []*legacymodels.AlertNotification
	var channels []*legacymodels.AlertNotification
	for _, c := range allChannels {
		if c.Type == "hipchat" || c.Type == "sensu" {
			om.log.Error("Alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.UID)
			continue
		}

		if c.IsDefault {
			defaultChannels = append(defaultChannels, c)
		}
		channels = append(channels, c)
	}

	amConfig := &apimodels.PostableUserConfig{
		AlertmanagerConfig: apimodels.PostableApiAlertingConfig{
			Receivers: make([]*apimodels.PostableApiReceiver, 0),
		},
	}

	// Create all newly migrated receivers from legacy notification channels.
	receiversMap, receivers, err := om.createReceivers(channels)
	if err != nil {
		return nil, fmt.Errorf("create receiver: %w", err)
	}

	// No need to create an Alertmanager configuration if there are no receivers left that aren't obsolete.
	if len(receivers) == 0 {
		om.log.Warn("No available receivers")
		return nil, nil
	}

	for _, cr := range receivers {
		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, cr.receiver)
	}

	defaultReceivers := make(map[string]struct{})
	// If the organization has default channels build a map of default receivers, used to create alert-specific routes later.
	for _, c := range defaultChannels {
		defaultReceivers[c.Name] = struct{}{}
	}
	defaultReceiver, defaultRoute, err := om.createDefaultRouteAndReceiver(defaultChannels)
	if err != nil {
		return nil, fmt.Errorf("failed to create default route & receiver in orgId %d: %w", om.orgID, err)
	}
	amConfig.AlertmanagerConfig.Route = defaultRoute
	if defaultReceiver != nil {
		amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, defaultReceiver)
	}

	for _, cr := range receivers {
		route, err := createRoute(cr)
		if err != nil {
			return nil, fmt.Errorf("failed to create route for receiver %s in orgId %d: %w", cr.receiver.Name, om.orgID, err)
		}

		amConfig.AlertmanagerConfig.Route.Routes = append(amConfig.AlertmanagerConfig.Route.Routes, route)
	}

	for _, pair := range pairs {
		channelUids := extractChannelIDs(pair.DashAlert)
		filteredReceiverNames := om.filterReceiversForAlert(pair.AlertRule.Title, channelUids, receiversMap, defaultReceivers)

		if len(filteredReceiverNames) != 0 {
			// Only create a contact label if there are specific receivers, otherwise it defaults to the root-level route.
			pair.AlertRule.Labels[ContactLabel] = contactListToString(filteredReceiverNames)
		}
	}

	// Validate the alertmanager configuration produced, this gives a chance to catch bad configuration at migration time.
	// Validation between legacy and unified alerting can be different (e.g. due to bug fixes) so this would fail the migration in that case.
	if err := om.validateAlertmanagerConfig(amConfig); err != nil {
		return nil, fmt.Errorf("failed to validate AlertmanagerConfig in orgId %d: %w", om.orgID, err)
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

// contactListToString creates a sorted string representation of a given map (set) of receiver names. Each name will be comma-separated and double-quoted. Names should not contain double quotes.
func contactListToString(m map[string]any) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, quote(k))
	}
	sort.Strings(keys)

	return strings.Join(keys, ",")
}

// quote will surround the given string in double quotes.
func quote(s string) string {
	return `"` + s + `"`
}

// Create a notifier (PostableGrafanaReceiver) from a legacy notification channel
func (om *OrgMigration) createNotifier(c *legacymodels.AlertNotification) (*apimodels.PostableGrafanaReceiver, error) {
	uid, err := om.determineChannelUid(c)
	if err != nil {
		return nil, err
	}

	settings, secureSettings, err := om.migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
	if err != nil {
		return nil, err
	}

	data, err := settings.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return &apimodels.PostableGrafanaReceiver{
		UID:                   uid,
		Name:                  c.Name,
		Type:                  c.Type,
		DisableResolveMessage: c.DisableResolveMessage,
		Settings:              data,
		SecureSettings:        secureSettings,
	}, nil
}

// Create one receiver for every unique notification channel.
func (om *OrgMigration) createReceivers(allChannels []*legacymodels.AlertNotification) (map[migrationStore.UidOrID]*apimodels.PostableApiReceiver, []channelReceiver, error) {
	receivers := make([]channelReceiver, 0, len(allChannels))
	receiversMap := make(map[migrationStore.UidOrID]*apimodels.PostableApiReceiver)

	set := make(map[string]struct{}) // Used to deduplicate sanitized names.
	for _, c := range allChannels {
		notifier, err := om.createNotifier(c)
		if err != nil {
			return nil, nil, err
		}

		// We remove double quotes because this character will be used as the separator in the ContactLabel. To prevent partial matches in the Route Matcher we choose to sanitize them early on instead of complicating the Matcher regex.
		sanitizedName := strings.ReplaceAll(c.Name, `"`, `_`)
		// There can be name collisions after we sanitize. We check for this and attempt to make the name unique again using a short hash of the original name.
		if _, ok := set[sanitizedName]; ok {
			sanitizedName = sanitizedName + fmt.Sprintf("_%.3x", md5.Sum([]byte(c.Name)))
			om.log.Warn("Alert contains duplicate contact name after sanitization, appending unique suffix", "type", c.Type, "name", c.Name, "new_name", sanitizedName, "uid", c.UID)
		}
		notifier.Name = sanitizedName

		set[sanitizedName] = struct{}{}

		cr := channelReceiver{
			channel: c,
			receiver: &apimodels.PostableApiReceiver{
				Receiver: config.Receiver{
					Name: sanitizedName, // Channel name is unique within an Org.
				},
				PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{notifier},
				},
			},
		}

		receivers = append(receivers, cr)

		// Store receivers for creating routes from alert rules later.
		if c.UID != "" {
			receiversMap[c.UID] = cr.receiver
		}
		if c.ID != 0 {
			// In certain circumstances, the alert rule uses ID instead of uid. So, we add this to be able to lookup by ID in case.
			receiversMap[c.ID] = cr.receiver
		}
	}

	return receiversMap, receivers, nil
}

// Create the root-level route with the default receiver. If no new receiver is created specifically for the root-level route, the returned receiver will be nil.
func (om *OrgMigration) createDefaultRouteAndReceiver(defaultChannels []*legacymodels.AlertNotification) (*apimodels.PostableApiReceiver, *apimodels.Route, error) {
	defaultReceiverName := "autogen-contact-point-default"
	defaultRoute := &apimodels.Route{
		Receiver:       defaultReceiverName,
		Routes:         make([]*apimodels.Route, 0),
		GroupByStr:     []string{ngmodels.FolderTitleLabel, model.AlertNameLabel}, // To keep parity with pre-migration notifications.
		RepeatInterval: nil,
	}
	newDefaultReceiver := &apimodels.PostableApiReceiver{
		Receiver: config.Receiver{
			Name: defaultReceiverName,
		},
		PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
			GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{},
		},
	}

	// Return early if there are no default channels
	if len(defaultChannels) == 0 {
		return newDefaultReceiver, defaultRoute, nil
	}

	repeatInterval := DisabledRepeatInterval // If no channels have SendReminders enabled, we will use this large value as a pseudo-disable.
	if len(defaultChannels) > 1 {
		// If there are more than one default channels we create a separate contact group that is used only in the root policy. This is to simplify the migrated notification policy structure.
		// If we ever allow more than one receiver per route this won't be necessary.
		for _, c := range defaultChannels {
			// Need to create a new notifier to prevent uid conflict.
			defaultNotifier, err := om.createNotifier(c)
			if err != nil {
				return nil, nil, err
			}

			newDefaultReceiver.GrafanaManagedReceivers = append(newDefaultReceiver.GrafanaManagedReceivers, defaultNotifier)

			// Choose the lowest send reminder duration from all the notifiers to use for default route.
			if c.SendReminder && c.Frequency < time.Duration(repeatInterval) {
				repeatInterval = model.Duration(c.Frequency)
			}
		}
	} else {
		// If there is only a single default channel, we don't need a separate receiver to hold it. We can reuse the existing receiver for that single notifier.
		defaultRoute.Receiver = defaultChannels[0].Name
		if defaultChannels[0].SendReminder {
			repeatInterval = model.Duration(defaultChannels[0].Frequency)
		}

		// No need to create a new receiver.
		newDefaultReceiver = nil
	}
	defaultRoute.RepeatInterval = &repeatInterval

	return newDefaultReceiver, defaultRoute, nil
}

// Create one route per contact point, matching based on ContactLabel.
func createRoute(cr channelReceiver) (*apimodels.Route, error) {
	// We create a regex matcher so that each alert rule need only have a single ContactLabel entry for all contact points it sends to.
	// For example, if an alert needs to send to contact1 and contact2 it will have ContactLabel=`"contact1","contact2"` and will match both routes looking
	// for `.*"contact1".*` and `.*"contact2".*`.

	// We quote and escape here to ensure the regex will correctly match the ContactLabel on the alerts.
	name := fmt.Sprintf(`.*%s.*`, regexp.QuoteMeta(quote(cr.receiver.Name)))
	mat, err := labels.NewMatcher(labels.MatchRegexp, ContactLabel, name)
	if err != nil {
		return nil, err
	}

	repeatInterval := DisabledRepeatInterval
	if cr.channel.SendReminder {
		repeatInterval = model.Duration(cr.channel.Frequency)
	}

	return &apimodels.Route{
		Receiver:       cr.receiver.Name,
		ObjectMatchers: apimodels.ObjectMatchers{mat},
		Continue:       true, // We continue so that each sibling contact point route can separately match.
		RepeatInterval: &repeatInterval,
	}, nil
}

// Filter receivers to select those that were associated to the given rule as channels.
func (om *OrgMigration) filterReceiversForAlert(name string, channelIDs []migrationStore.UidOrID, receivers map[migrationStore.UidOrID]*apimodels.PostableApiReceiver, defaultReceivers map[string]struct{}) map[string]any {
	if len(channelIDs) == 0 {
		// If there are no channels associated, we use the default route.
		return nil
	}

	// Filter receiver names.
	filteredReceiverNames := make(map[string]any)
	for _, uidOrId := range channelIDs {
		recv, ok := receivers[uidOrId]
		if ok {
			filteredReceiverNames[recv.Name] = struct{}{} // Deduplicate on contact point name.
		} else {
			om.log.Warn("Alert linked to obsolete notification channel, ignoring", "alert", name, "uid", uidOrId)
		}
	}

	coveredByDefault := func(names map[string]any) bool {
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
		return nil
	}

	// Add default receivers alongside rule-specific ones.
	for n := range defaultReceivers {
		filteredReceiverNames[n] = struct{}{}
	}

	return filteredReceiverNames
}

func (om *OrgMigration) determineChannelUid(c *legacymodels.AlertNotification) (string, error) {
	legacyUid := c.UID
	if legacyUid == "" {
		newUid := util.GenerateShortUID()
		om.seenUIDs.add(newUid)
		om.log.Info("Legacy notification had an empty uid, generating a new one", "id", c.ID, "uid", newUid)
		return newUid, nil
	}

	if om.seenUIDs.contains(legacyUid) {
		newUid := util.GenerateShortUID()
		om.seenUIDs.add(newUid)
		om.log.Warn("Legacy notification had a UID that collides with a migrated record, generating a new one", "id", c.ID, "old", legacyUid, "new", newUid)
		return newUid, nil
	}

	om.seenUIDs.add(legacyUid)
	return legacyUid, nil
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
			return fmt.Errorf("failed to encrypt secure settings: %w", err)
		}
		secureSettings[key] = base64.StdEncoding.EncodeToString(encryptedData)
	}
	return nil
}

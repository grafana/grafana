package ualert

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// DisabledRepeatInterval is a large duration that will be used as a pseudo-disable in case a legacy channel doesn't have SendReminders enabled.
	DisabledRepeatInterval = model.Duration(time.Duration(8736) * time.Hour) // 1y
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
	SendReminder          bool             `xorm:"send_reminder"`
	Frequency             model.Duration   `xorm:"frequency"`
}

// channelsPerOrg maps notification channels per organisation
type channelsPerOrg map[int64][]*notificationChannel

// channelMap maps notification channels per organisation
type defaultChannelsPerOrg map[int64][]*notificationChannel

// uidOrID for both uid and ID, primarily used for mapping legacy channel to migrated receiver.
type uidOrID interface{}

// channelReceiver is a convenience struct that contains a notificationChannel and its corresponding migrated PostableApiReceiver.
type channelReceiver struct {
	channel  *notificationChannel
	receiver *PostableApiReceiver
}

// setupAlertmanagerConfigs creates Alertmanager configs with migrated receivers and routes.
func (m *migration) setupAlertmanagerConfigs(rulesPerOrg map[int64]map[*alertRule][]uidOrID) (amConfigsPerOrg, error) {
	// allChannels: channelUID -> channelConfig
	allChannelsPerOrg, defaultChannelsPerOrg, err := m.getNotificationChannelMap()
	if err != nil {
		return nil, fmt.Errorf("failed to load notification channels: %w", err)
	}

	amConfigPerOrg := make(amConfigsPerOrg, len(allChannelsPerOrg))
	for orgID, channels := range allChannelsPerOrg {
		amConfig := &PostableUserConfig{
			AlertmanagerConfig: PostableApiAlertingConfig{
				Receivers: make([]*PostableApiReceiver, 0),
			},
		}
		amConfigPerOrg[orgID] = amConfig

		// Create all newly migrated receivers from legacy notification channels.
		receiversMap, receivers, err := m.createReceivers(channels)
		if err != nil {
			return nil, fmt.Errorf("failed to create receiver in orgId %d: %w", orgID, err)
		}

		// No need to create an Alertmanager configuration if there are no receivers left that aren't obsolete.
		if len(receivers) == 0 {
			m.mg.Logger.Warn("no available receivers", "orgId", orgID)
			continue
		}

		for _, cr := range receivers {
			amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, cr.receiver)
		}

		defaultReceivers := make(map[string]struct{})
		defaultChannels, ok := defaultChannelsPerOrg[orgID]
		if ok {
			// If the organization has default channels build a map of default receivers, used to create alert-specific routes later.
			for _, c := range defaultChannels {
				defaultReceivers[c.Name] = struct{}{}
			}
		}
		defaultReceiver, defaultRoute, err := m.createDefaultRouteAndReceiver(defaultChannels)
		if err != nil {
			return nil, fmt.Errorf("failed to create default route & receiver in orgId %d: %w", orgID, err)
		}
		amConfig.AlertmanagerConfig.Route = defaultRoute
		if defaultReceiver != nil {
			amConfig.AlertmanagerConfig.Receivers = append(amConfig.AlertmanagerConfig.Receivers, defaultReceiver)
		}

		for _, cr := range receivers {
			route, err := createRoute(cr)
			if err != nil {
				return nil, fmt.Errorf("failed to create route for receiver %s in orgId %d: %w", cr.receiver.Name, orgID, err)
			}

			amConfigPerOrg[orgID].AlertmanagerConfig.Route.Routes = append(amConfigPerOrg[orgID].AlertmanagerConfig.Route.Routes, route)
		}

		for ar, channelUids := range rulesPerOrg[orgID] {
			filteredReceiverNames := m.filterReceiversForAlert(ar.Title, channelUids, receiversMap, defaultReceivers)

			if len(filteredReceiverNames) != 0 {
				// Only create a contact label if there are specific receivers, otherwise it defaults to the root-level route.
				ar.Labels[ContactLabel] = contactListToString(filteredReceiverNames)
			}
		}

		// Validate the alertmanager configuration produced, this gives a chance to catch bad configuration at migration time.
		// Validation between legacy and unified alerting can be different (e.g. due to bug fixes) so this would fail the migration in that case.
		if err := m.validateAlertmanagerConfig(amConfig); err != nil {
			return nil, fmt.Errorf("failed to validate AlertmanagerConfig in orgId %d: %w", orgID, err)
		}
	}

	return amConfigPerOrg, nil
}

// contactListToString creates a sorted string representation of a given map (set) of receiver names. Each name will be comma-separated and double-quoted. Names should not contain double quotes.
func contactListToString(m map[string]interface{}) string {
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

// getNotificationChannelMap returns a map of all channelUIDs to channel config as well as a separate map for just those channels that are default.
// For any given Organization, all channels in defaultChannelsPerOrg should also exist in channelsPerOrg.
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
		secure_settings,
        send_reminder,
		frequency
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
		if c.Type == "hipchat" || c.Type == "sensu" {
			m.mg.Logger.Error("alert migration error: discontinued notification channel found", "type", c.Type, "name", c.Name, "uid", c.Uid)
			continue
		}

		allChannelsMap[c.OrgID] = append(allChannelsMap[c.OrgID], &allChannels[i])

		if c.IsDefault {
			defaultChannelsMap[c.OrgID] = append(defaultChannelsMap[c.OrgID], &allChannels[i])
		}
	}

	return allChannelsMap, defaultChannelsMap, nil
}

// Create a notifier (PostableGrafanaReceiver) from a legacy notification channel
func (m *migration) createNotifier(c *notificationChannel) (*PostableGrafanaReceiver, error) {
	uid, err := m.determineChannelUid(c)
	if err != nil {
		return nil, err
	}

	settings, secureSettings, err := migrateSettingsToSecureSettings(c.Type, c.Settings, c.SecureSettings)
	if err != nil {
		return nil, err
	}

	return &PostableGrafanaReceiver{
		UID:                   uid,
		Name:                  c.Name,
		Type:                  c.Type,
		DisableResolveMessage: c.DisableResolveMessage,
		Settings:              settings,
		SecureSettings:        secureSettings,
	}, nil
}

// Create one receiver for every unique notification channel.
func (m *migration) createReceivers(allChannels []*notificationChannel) (map[uidOrID]*PostableApiReceiver, []channelReceiver, error) {
	receivers := make([]channelReceiver, 0, len(allChannels))
	receiversMap := make(map[uidOrID]*PostableApiReceiver)

	set := make(map[string]struct{}) // Used to deduplicate sanitized names.
	for _, c := range allChannels {
		notifier, err := m.createNotifier(c)
		if err != nil {
			return nil, nil, err
		}

		// We remove double quotes because this character will be used as the separator in the ContactLabel. To prevent partial matches in the Route Matcher we choose to sanitize them early on instead of complicating the Matcher regex.
		sanitizedName := strings.ReplaceAll(c.Name, `"`, `_`)
		// There can be name collisions after we sanitize. We check for this and attempt to make the name unique again using a short hash of the original name.
		if _, ok := set[sanitizedName]; ok {
			sanitizedName = sanitizedName + fmt.Sprintf("_%.3x", md5.Sum([]byte(c.Name)))
			m.mg.Logger.Warn("alert contains duplicate contact name after sanitization, appending unique suffix", "type", c.Type, "name", c.Name, "new_name", sanitizedName, "uid", c.Uid)
		}
		notifier.Name = sanitizedName

		set[sanitizedName] = struct{}{}

		cr := channelReceiver{
			channel: c,
			receiver: &PostableApiReceiver{
				Name:                    sanitizedName, // Channel name is unique within an Org.
				GrafanaManagedReceivers: []*PostableGrafanaReceiver{notifier},
			},
		}

		receivers = append(receivers, cr)

		// Store receivers for creating routes from alert rules later.
		if c.Uid != "" {
			receiversMap[c.Uid] = cr.receiver
		}
		if c.ID != 0 {
			// In certain circumstances, the alert rule uses ID instead of uid. So, we add this to be able to lookup by ID in case.
			receiversMap[c.ID] = cr.receiver
		}
	}

	return receiversMap, receivers, nil
}

// Create the root-level route with the default receiver. If no new receiver is created specifically for the root-level route, the returned receiver will be nil.
func (m *migration) createDefaultRouteAndReceiver(defaultChannels []*notificationChannel) (*PostableApiReceiver, *Route, error) {
	defaultReceiverName := "autogen-contact-point-default"
	defaultRoute := &Route{
		Receiver:       defaultReceiverName,
		Routes:         make([]*Route, 0),
		GroupByStr:     []string{ngModels.FolderTitleLabel, model.AlertNameLabel}, // To keep parity with pre-migration notifications.
		RepeatInterval: nil,
	}
	newDefaultReceiver := &PostableApiReceiver{
		Name:                    defaultReceiverName,
		GrafanaManagedReceivers: []*PostableGrafanaReceiver{},
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
			defaultNotifier, err := m.createNotifier(c)
			if err != nil {
				return nil, nil, err
			}

			newDefaultReceiver.GrafanaManagedReceivers = append(newDefaultReceiver.GrafanaManagedReceivers, defaultNotifier)

			// Choose the lowest send reminder duration from all the notifiers to use for default route.
			if c.SendReminder && c.Frequency < repeatInterval {
				repeatInterval = c.Frequency
			}
		}
	} else {
		// If there is only a single default channel, we don't need a separate receiver to hold it. We can reuse the existing receiver for that single notifier.
		defaultRoute.Receiver = defaultChannels[0].Name
		if defaultChannels[0].SendReminder {
			repeatInterval = defaultChannels[0].Frequency
		}

		// No need to create a new receiver.
		newDefaultReceiver = nil
	}
	defaultRoute.RepeatInterval = &repeatInterval

	return newDefaultReceiver, defaultRoute, nil
}

// Create one route per contact point, matching based on ContactLabel.
func createRoute(cr channelReceiver) (*Route, error) {
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
		repeatInterval = cr.channel.Frequency
	}

	return &Route{
		Receiver:       cr.receiver.Name,
		ObjectMatchers: ObjectMatchers{mat},
		Continue:       true, // We continue so that each sibling contact point route can separately match.
		RepeatInterval: &repeatInterval,
	}, nil
}

// Filter receivers to select those that were associated to the given rule as channels.
func (m *migration) filterReceiversForAlert(name string, channelIDs []uidOrID, receivers map[uidOrID]*PostableApiReceiver, defaultReceivers map[string]struct{}) map[string]interface{} {
	if len(channelIDs) == 0 {
		// If there are no channels associated, we use the default route.
		return nil
	}

	// Filter receiver names.
	filteredReceiverNames := make(map[string]interface{})
	for _, uidOrId := range channelIDs {
		recv, ok := receivers[uidOrId]
		if ok {
			filteredReceiverNames[recv.Name] = struct{}{} // Deduplicate on contact point name.
		} else {
			m.mg.Logger.Warn("alert linked to obsolete notification channel, ignoring", "alert", name, "uid", uidOrId)
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
		return nil
	}

	// Add default receivers alongside rule-specific ones.
	for n := range defaultReceivers {
		filteredReceiverNames[n] = struct{}{}
	}

	return filteredReceiverNames
}

func (m *migration) determineChannelUid(c *notificationChannel) (string, error) {
	legacyUid := c.Uid
	if legacyUid == "" {
		newUid, err := m.seenUIDs.generateUid()
		if err != nil {
			return "", err
		}
		m.mg.Logger.Info("Legacy notification had an empty uid, generating a new one", "id", c.ID, "uid", newUid)
		return newUid, nil
	}

	if m.seenUIDs.contains(legacyUid) {
		newUid, err := m.seenUIDs.generateUid()
		if err != nil {
			return "", err
		}
		m.mg.Logger.Warn("Legacy notification had a UID that collides with a migrated record, generating a new one", "id", c.ID, "old", legacyUid, "new", newUid)
		return newUid, nil
	}

	return legacyUid, nil
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

	encryptedData := GetEncryptedJsonData(newSecureSettings)
	for k, v := range encryptedData {
		newSecureSettings[k] = base64.StdEncoding.EncodeToString(v)
	}

	return cloneSettings, newSecureSettings, nil
}

// Below is a snapshot of all the config and supporting functions imported
// to avoid vendoring those packages.

type PostableUserConfig struct {
	TemplateFiles      map[string]string         `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig PostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
}

type amConfigsPerOrg = map[int64]*PostableUserConfig

type PostableApiAlertingConfig struct {
	Route     *Route                 `yaml:"route,omitempty" json:"route,omitempty"`
	Templates []string               `yaml:"templates" json:"templates"`
	Receivers []*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type Route struct {
	Receiver       string          `yaml:"receiver,omitempty" json:"receiver,omitempty"`
	ObjectMatchers ObjectMatchers  `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	Routes         []*Route        `yaml:"routes,omitempty" json:"routes,omitempty"`
	Continue       bool            `yaml:"continue,omitempty" json:"continue,omitempty"`
	GroupByStr     []string        `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	RepeatInterval *model.Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`
}

type ObjectMatchers labels.Matchers

// MarshalJSON implements the json.Marshaler interface for Matchers. Vendored from definitions.ObjectMatchers.
func (m ObjectMatchers) MarshalJSON() ([]byte, error) {
	if len(m) == 0 {
		return nil, nil
	}
	result := make([][3]string, len(m))
	for i, matcher := range m {
		result[i] = [3]string{matcher.Name, matcher.Type.String(), matcher.Value}
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

package notifiers

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

// notificationsAsConfig is normalized data object for notifications config data. Any config version should be mappable
// to this type.
type notificationsAsConfig struct {
	Notifications       []*notificationFromConfig
	DeleteNotifications []*deleteNotificationConfig
}

type deleteNotificationConfig struct {
	UID     string
	Name    string
	OrgID   int64
	OrgName string
}

type notificationFromConfig struct {
	UID                   string
	OrgID                 int64
	OrgName               string
	Name                  string
	Type                  string
	SendReminder          bool
	DisableResolveMessage bool
	Frequency             string
	IsDefault             bool
	Settings              map[string]interface{}
}

// notificationsAsConfigV0 is mapping for zero version configs. This is mapped to its normalised version.
type notificationsAsConfigV0 struct {
	Notifications       []*notificationFromConfigV0   `json:"notifiers" yaml:"notifiers"`
	DeleteNotifications []*deleteNotificationConfigV0 `json:"delete_notifiers" yaml:"delete_notifiers"`
}

type deleteNotificationConfigV0 struct {
	UID     values.StringValue `json:"uid" yaml:"uid"`
	Name    values.StringValue `json:"name" yaml:"name"`
	OrgID   values.Int64Value  `json:"org_id" yaml:"org_id"`
	OrgName values.StringValue `json:"org_name" yaml:"org_name"`
}

type notificationFromConfigV0 struct {
	UID                   values.StringValue `json:"uid" yaml:"uid"`
	OrgID                 values.Int64Value  `json:"org_id" yaml:"org_id"`
	OrgName               values.StringValue `json:"org_name" yaml:"org_name"`
	Name                  values.StringValue `json:"name" yaml:"name"`
	Type                  values.StringValue `json:"type" yaml:"type"`
	SendReminder          values.BoolValue   `json:"send_reminder" yaml:"send_reminder"`
	DisableResolveMessage values.BoolValue   `json:"disable_resolve_message" yaml:"disable_resolve_message"`
	Frequency             values.StringValue `json:"frequency" yaml:"frequency"`
	IsDefault             values.BoolValue   `json:"is_default" yaml:"is_default"`
	Settings              values.JSONValue   `json:"settings" yaml:"settings"`
}

func (notification notificationFromConfig) SettingsToJSON() *simplejson.Json {
	settings := simplejson.New()
	if len(notification.Settings) > 0 {
		for k, v := range notification.Settings {
			settings.Set(k, v)
		}
	}
	return settings
}

// mapToNotificationFromConfig maps config syntax to normalized notificationsAsConfig object. Every version
// of the config syntax should have this function.
func (cfg *notificationsAsConfigV0) mapToNotificationFromConfig() *notificationsAsConfig {
	r := &notificationsAsConfig{}
	if cfg == nil {
		return r
	}

	for _, notification := range cfg.Notifications {
		r.Notifications = append(r.Notifications, &notificationFromConfig{
			UID:                   notification.UID.Value(),
			OrgID:                 notification.OrgID.Value(),
			OrgName:               notification.OrgName.Value(),
			Name:                  notification.Name.Value(),
			Type:                  notification.Type.Value(),
			IsDefault:             notification.IsDefault.Value(),
			Settings:              notification.Settings.Value(),
			DisableResolveMessage: notification.DisableResolveMessage.Value(),
			Frequency:             notification.Frequency.Value(),
			SendReminder:          notification.SendReminder.Value(),
		})
	}

	for _, notification := range cfg.DeleteNotifications {
		r.DeleteNotifications = append(r.DeleteNotifications, &deleteNotificationConfig{
			UID:     notification.UID.Value(),
			OrgID:   notification.OrgID.Value(),
			OrgName: notification.OrgName.Value(),
			Name:    notification.Name.Value(),
		})
	}

	return r
}

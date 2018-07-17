package alert_notifications

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type notificationsAsConfig struct {
	Notifications       []*notificationFromConfig   `json:"alert_notifications" yaml:"alert_notifications"`
	DeleteNotifications []*deleteNotificationConfig `json:"delete_alert_notifications" yaml:"delete_alert_notifications"`
}

type deleteNotificationConfig struct {
	Name  string `json:"name" yaml:"name"`
	OrgId int64  `json:"org_id" yaml:"org_id"`
}

type notificationFromConfig struct {
	OrgId int64 `json:"org_id" yaml:"org_id"`

	Uid       string                 `json:"uid"`
	Name      string                 `json:"name" yaml:"name"`
	Type      string                 `json:"type" yaml:"type"`
	IsDefault bool                   `json:"is_default" yaml:"is_default"`
	Settings  map[string]interface{} `json:"settings" yaml:"settings"`
}

func (cfg *notificationsAsConfig) mapToNotificationFromConfig() *notificationsAsConfig {
	r := &notificationsAsConfig{}

	if cfg == nil {
		return r
	}

	for _, notification := range cfg.Notifications {
		r.Notifications = append(r.Notifications, &notificationFromConfig{
			Uid:       notification.Uid,
			OrgId:     notification.OrgId,
			Name:      notification.Name,
			Type:      notification.Type,
			IsDefault: notification.IsDefault,
			Settings:  notification.Settings,
		})
	}

	for _, notification := range cfg.DeleteNotifications {
		r.DeleteNotifications = append(r.DeleteNotifications, &deleteNotificationConfig{
			OrgId: notification.OrgId,
			Name:  notification.Name,
		})
	}

	return r
}

func createInsertCommand(notification *notificationFromConfig) *models.CreateAlertNotificationCommand {
	settings := simplejson.New()
	if len(notification.Settings) > 0 {
		for k, v := range notification.Settings {
			settings.Set(k, v)
		}
	}

	return &models.CreateAlertNotificationCommand{
		Uid:       notification.Uid,
		Name:      notification.Name,
		Type:      notification.Type,
		IsDefault: notification.IsDefault,
		Settings:  settings,
		OrgId:     notification.OrgId,
	}
}

func createUpdateCommand(notification *notificationFromConfig, id int64) *models.UpdateAlertNotificationCommand {
	settings := simplejson.New()
	if len(notification.Settings) > 0 {
		for k, v := range notification.Settings {
			settings.Set(k, v)
		}
	}

	return &models.UpdateAlertNotificationCommand{
		Id:        id,
		Name:      notification.Name,
		Type:      notification.Type,
		IsDefault: notification.IsDefault,
		Settings:  settings,
		OrgId:     notification.OrgId,
	}
}

package alert_notifications

type notificationsAsConfig struct {
	Notifications       []*notificationFromConfig   `json:"alert_notifications" yaml:"alert_notifications"`
	DeleteNotifications []*deleteNotificationConfig `json:"delete_alert_notifications" yaml:"delete_alert_notifications"`
}

type deleteNotificationConfig struct {
	Name    string `json:"name" yaml:"name"`
	OrgId   int64  `json:"org_id" yaml:"org_id"`
	OrgName string `json:"org_name" yaml:"org_name"`
}

type notificationFromConfig struct {
	OrgId     int64                  `json:"org_id" yaml:"org_id"`
	OrgName   string                 `json:"org_name" yaml:"org_name"`
	Name      string                 `json:"name" yaml:"name"`
	Type      string                 `json:"type" yaml:"type"`
	IsDefault bool                   `json:"is_default" yaml:"is_default"`
	Settings  map[string]interface{} `json:"settings" yaml:"settings"`
}

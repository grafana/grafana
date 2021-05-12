package models

import "time"

const AlertConfigurationVersion = 1

// AlertConfiguration represents a single version of the Alerting Engine Configuration.
type AlertConfiguration struct {
	ID int64 `xorm:"pk autoincr 'id'"`

	AlertmanagerConfiguration string
	ConfigurationVersion      string
	CreatedAt                 time.Time `xorm:"created"`
}

// GetLatestAlertmanagerConfigurationQuery is the query to get the latest alertmanager configuration.
type GetLatestAlertmanagerConfigurationQuery struct {
	Result *AlertConfiguration
}

// GetAlertmanagerConfigurationQuery is the query to get the latest alertmanager configuration.
type GetAlertmanagerConfigurationQuery struct {
	ID int64

	Result *AlertConfiguration
}

// SaveAlertmanagerConfigurationCmd is the command to save an alertmanager configuration.
type SaveAlertmanagerConfigurationCmd struct {
	AlertmanagerConfiguration string
	ConfigurationVersion      string
}

type DeleteAlertmanagerConfigurationCmd struct {
	ID int64
}

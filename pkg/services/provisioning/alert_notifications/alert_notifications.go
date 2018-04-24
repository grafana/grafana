package alert_notifications

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

var (
	ErrInvalidConfigTooManyDefault = errors.New("Alert notification provisioning config is invalid. Only one alert notification can be marked as default")
	ErrInvalidNotifierType         = errors.New("Unknown notifier type")
)

func Provision(configDirectory string) error {
	dc := newNotificationProvisioner(log.New("provisioning.alert_notifications"))
	return dc.applyChanges(configDirectory)
}

type NotificationProvisioner struct {
	log         log.Logger
	cfgProvider *configReader
}

func newNotificationProvisioner(log log.Logger) NotificationProvisioner {
	return NotificationProvisioner{
		log:         log,
		cfgProvider: &configReader{log: log},
	}
}

func (dc *NotificationProvisioner) apply(cfg *notificationsAsConfig) error {
	if err := dc.deleteNotifications(cfg.DeleteNotifications); err != nil {
		return err
	}

	for _, notification := range cfg.Notifications {
		cmd := &models.GetAlertNotificationsQuery{OrgId: notification.OrgId, Name: notification.Name}
		err := bus.Dispatch(cmd)
		if err != nil {
			return err
		}

		if cmd.Result == nil {
			dc.log.Info("Inserting alert notification from configuration ", "name", notification.Name)
			insertCmd := createInsertCommand(notification)
			if err := bus.Dispatch(insertCmd); err != nil {
				return err
			}
		} else {
			dc.log.Info("Updating alert notification from configuration", "name", notification.Name)
			updateCmd := createUpdateCommand(notification, cmd.Result.Id)
			if err := bus.Dispatch(updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *NotificationProvisioner) applyChanges(configPath string) error {
	configs, err := dc.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}

func (dc *NotificationProvisioner) deleteNotifications(notificationToDelete []*deleteNotificationConfig) error {
	for _, notification := range notificationToDelete {
		dc.log.Info("Deleting alert notification", "name", notification.Name)
		cmd := &models.DeleteAlertNotificationByNameCommand{OrgId: notification.OrgId, Name: notification.Name}
		if err := bus.Dispatch(cmd); err != nil {
			return err
		}
	}

	return nil
}

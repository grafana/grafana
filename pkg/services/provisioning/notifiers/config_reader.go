package notifiers

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"gopkg.in/yaml.v2"
)

type configReader struct {
	log log.Logger
}

func (cr *configReader) readConfig(path string) ([]*notificationsAsConfig, error) {
	var notifications []*notificationsAsConfig
	cr.log.Debug("Looking for alert notification provisioning files", "path", path)

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("Can't read alert notification provisioning files from directory", "path", path, "error", err)
		return notifications, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			cr.log.Debug("Parsing alert notifications provisioning file", "path", path, "file.Name", file.Name())
			notifs, err := cr.parseNotificationConfig(path, file)
			if err != nil {
				return nil, err
			}

			if notifs != nil {
				notifications = append(notifications, notifs)
			}
		}
	}

	cr.log.Debug("Validating alert notifications")
	if err = validateRequiredField(notifications); err != nil {
		return nil, err
	}

	checkOrgIdAndOrgName(notifications)

	err = validateNotifications(notifications)
	if err != nil {
		return nil, err
	}

	return notifications, nil
}

func (cr *configReader) parseNotificationConfig(path string, file os.FileInfo) (*notificationsAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *notificationsAsConfigV0
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	return cfg.mapToNotificationFromConfig(), nil
}

func checkOrgIdAndOrgName(notifications []*notificationsAsConfig) {
	for i := range notifications {
		for _, notification := range notifications[i].Notifications {
			if notification.OrgId < 1 {
				if notification.OrgName == "" {
					notification.OrgId = 1
				} else {
					notification.OrgId = 0
				}
			}
		}

		for _, notification := range notifications[i].DeleteNotifications {
			if notification.OrgId < 1 {
				if notification.OrgName == "" {
					notification.OrgId = 1
				} else {
					notification.OrgId = 0
				}
			}
		}
	}
}

func validateRequiredField(notifications []*notificationsAsConfig) error {
	for i := range notifications {
		var errStrings []string
		for index, notification := range notifications[i].Notifications {
			if notification.Name == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Added alert notification item %d in configuration doesn't contain required field name", index+1),
				)
			}

			if notification.Uid == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Added alert notification item %d in configuration doesn't contain required field uid", index+1),
				)
			}
		}

		for index, notification := range notifications[i].DeleteNotifications {
			if notification.Name == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Deleted alert notification item %d in configuration doesn't contain required field name", index+1),
				)
			}

			if notification.Uid == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Deleted alert notification item %d in configuration doesn't contain required field uid", index+1),
				)
			}
		}

		if len(errStrings) != 0 {
			return fmt.Errorf(strings.Join(errStrings, "\n"))
		}
	}

	return nil
}

func validateNotifications(notifications []*notificationsAsConfig) error {

	for i := range notifications {
		if notifications[i].Notifications == nil {
			continue
		}

		for _, notification := range notifications[i].Notifications {
			_, err := alerting.InitNotifier(&m.AlertNotification{
				Name:     notification.Name,
				Settings: notification.SettingsToJson(),
				Type:     notification.Type,
			})

			if err != nil {
				return err
			}
		}
	}

	return nil
}

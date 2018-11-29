package alert_notifications

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/log"
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
		cr.log.Error("Can't read alert notification provisioning files from directory", "path", path)
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
	err = validateDefaultUniqueness(notifications)
	if err != nil {
		return nil, err
	}

	err = validateType(notifications)
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

	var cfg *notificationsAsConfig
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	return cfg.mapToNotificationFromConfig(), nil
}

func validateDefaultUniqueness(notifications []*notificationsAsConfig) error {
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

	return nil
}

func validateType(notifications []*notificationsAsConfig) error {
	notifierTypes := alerting.GetNotifiers()

	for i := range notifications {
		if notifications[i].Notifications == nil {
			continue
		}

		for _, notification := range notifications[i].Notifications {
			foundNotifier := false

			for _, notifier := range notifierTypes {
				if notifier.Type == notification.Type {
					foundNotifier = true
					break
				}
			}

			if !foundNotifier {
				return ErrInvalidNotifierType
			}
		}
	}

	return nil
}

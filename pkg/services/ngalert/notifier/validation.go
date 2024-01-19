package notifier

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type notificaitonSettingsValidator interface {
	Validate(settings models.NotificationSettings) error
}

type NotificationSettingsValidator struct {
	hasReceiver   func(string)bool
	hasMuteTiming func(string)bool
}

func NewNotificationSettingsValidator(am definitions.PostableApiAlertingConfig) NotificationSettingsValidator {
	availableReceivers := make(map[string]struct{}, len(am.Receivers))
	for _, receiver := range am.Receivers {
		availableReceivers[receiver.Name] = struct{}{}
	}
	availableMuteTimings := make(map[string]struct{}, len(am.MuteTimeIntervals))
	for _, interval := range am.MuteTimeIntervals {
		availableReceivers[interval.Name] = struct{}{}
	}
	return NotificationSettingsValidator{
		hasReceiver: func(s string) bool {
			_, ok := availableReceivers[s]
			return ok
		},
		hasMuteTiming: func(s string) bool {
			_, ok := availableMuteTimings[s]
			return ok
		},
	}
}

// Validate checks that models.NotificationSettings is valid and refers to the available receiver and mute timings
func (n NotificationSettingsValidator) Validate(settings models.NotificationSettings) error {
	if err := settings.Validate(); err != nil {
		return err
	}
	if !n.hasReceiver(settings.Receiver) {
		return fmt.Errorf("receiver '%s' does not exist", settings.Receiver)
	}
	for _, interval := range settings.MuteTimeIntervals {
		if !n.hasMuteTiming(interval) {
			return fmt.Errorf("mute time interval '%s' does not exist", interval)
		}
	}
	return nil
}


type noValidation struct {

}

func (n noValidation) Validate(_ models.NotificationSettings) error {
	return nil
}

package provisioning

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrValidation = fmt.Errorf("invalid object specification")
var ErrNotFound = fmt.Errorf("object not found")
var ErrPermissionDenied = errors.New("permission denied")

var (
	ErrNoAlertmanagerConfiguration  = errutil.Internal("alerting.notification.configMissing", errutil.WithPublicMessage("No alertmanager configuration present in this organization"))
	ErrBadAlertmanagerConfiguration = errutil.Internal("alerting.notification.configCorrupted").MustTemplate("Failed to unmarshal the Alertmanager configuration", errutil.WithPublic("Current Alertmanager configuration in the storage is corrupted. Reset the configuration or rollback to a recent valid one."))

	ErrMuteTimingsNotFound = errutil.NotFound("alerting.notifications.mute-timings.notFound")
	ErrMuteTimingExists    = errutil.BadRequest("alerting.notifications.mute-timings.nameExists", errutil.WithPublicMessage("Mute timing with this name already exists. Use a different name or update existing one."))
	ErrMuteTimingInvalid   = errutil.BadRequest("alerting.notifications.mute-timings.invalidFormat").MustTemplate("Invalid format of the submitted mute timing", errutil.WithPublic("Mute timing is in invalid format. Correct the payload and try again."))
	ErrMuteTimingInUse     = errutil.BadRequest("alerting.notifications.mute-timings.used", errutil.WithPublicMessage("Mute timing is used by one or many notification policies"))
)

func makeErrBadAlertmanagerConfiguration(err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Error": err.Error(),
		},
		Error: err,
	}
	return ErrBadAlertmanagerConfiguration.Build(data)
}

// MakeErrMuteTimingInvalid creates an error with the ErrMuteTimingInvalid template
func MakeErrMuteTimingInvalid(err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Error": err.Error(),
		},
		Error: err,
	}

	return ErrMuteTimingInvalid.Build(data)
}

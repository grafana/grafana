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

	ErrTimeIntervalNotFound = errutil.NotFound("alerting.notifications.time-intervals.notFound")
	ErrTimeIntervalExists   = errutil.BadRequest("alerting.notifications.time-intervals.nameExists", errutil.WithPublicMessage("Time interval with this name already exists. Use a different name or update existing one."))
	ErrTimeIntervalInvalid  = errutil.BadRequest("alerting.notifications.time-intervals.invalidFormat").MustTemplate("Invalid format of the submitted time interval", errutil.WithPublic("Time interval is in invalid format. Correct the payload and try again."))
	ErrTimeIntervalInUse    = errutil.Conflict("alerting.notifications.time-intervals.used", errutil.WithPublicMessage("Time interval is used by one or many notification policies"))
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

// MakeErrTimeIntervalInvalid creates an error with the ErrTimeIntervalInvalid template
func MakeErrTimeIntervalInvalid(err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Error": err.Error(),
		},
		Error: err,
	}

	return ErrTimeIntervalInvalid.Build(data)
}

package provisioning

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var ErrValidation = fmt.Errorf("invalid object specification")
var ErrNotFound = fmt.Errorf("object not found")
var ErrPermissionDenied = errors.New("permission denied")

var (
	ErrNoAlertmanagerConfiguration  = errutil.Internal("alerting.notification.configMissing", errutil.WithPublicMessage("No alertmanager configuration present in this organization"))
	ErrBadAlertmanagerConfiguration = errutil.Internal("alerting.notification.configCorrupted").MustTemplate("Failed to unmarshal the Alertmanager configuration", errutil.WithPublic("Current Alertmanager configuration in the storage is corrupted. Reset the configuration or rollback to a recent valid one."))

	ErrProvenanceChangeNotAllowed = errutil.Forbidden("alerting.notifications.invalidProvenance").MustTemplate(
		"Resource with provenance status '{{ .Public.SourceProvenance }}' cannot be managed via API that handles resources with provenance status '{{ .Public.TargetProvenance }}'",
		errutil.WithPublic("Resource with provenance status '{{ .Public.SourceProvenance }}' cannot be managed via API that handles resources with provenance status '{{ .Public.TargetProvenance }}'. You must use appropriate API to manage this resource"),
	)

	ErrVersionConflict = errutil.Conflict("alerting.notifications.conflict")

	ErrTimeIntervalNotFound = errutil.NotFound("alerting.notifications.time-intervals.notFound")
	ErrTimeIntervalExists   = errutil.BadRequest("alerting.notifications.time-intervals.nameExists", errutil.WithPublicMessage("Time interval with this name already exists. Use a different name or update existing one."))
	ErrTimeIntervalInvalid  = errutil.BadRequest("alerting.notifications.time-intervals.invalidFormat").MustTemplate("Invalid format of the submitted time interval", errutil.WithPublic("Time interval is in invalid format. Correct the payload and try again."))
	ErrTimeIntervalInUse    = errutil.Conflict("alerting.notifications.time-intervals.used", errutil.WithPublicMessage("Time interval is used by one or many notification policies"))

	ErrContactPointReferenced = errutil.Conflict("alerting.notifications.contact-points.referenced", errutil.WithPublicMessage("Contact point is currently referenced by a notification policy."))
	ErrContactPointUsedInRule = errutil.Conflict("alerting.notifications.contact-points.used-by-rule", errutil.WithPublicMessage("Contact point is currently used in the notification settings of one or many alert rules."))
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

func MakeErrProvenanceChangeNotAllowed(from, to models.Provenance) error {
	if to == "" {
		to = "none"
	}
	if from == "" {
		from = "none"
	}
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"TargetProvenance": to,
			"SourceProvenance": from,
		},
	}
	return ErrProvenanceChangeNotAllowed.Build(data)
}

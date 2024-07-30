package provisioning

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var ErrValidation = fmt.Errorf("invalid object specification")
var ErrNotFound = fmt.Errorf("object not found")

var (
	ErrVersionConflict = errutil.Conflict("alerting.notifications.conflict")

	ErrTimeIntervalNotFound = errutil.NotFound("alerting.notifications.time-intervals.notFound")
	ErrTimeIntervalExists   = errutil.BadRequest("alerting.notifications.time-intervals.nameExists", errutil.WithPublicMessage("Time interval with this name already exists. Use a different name or update existing one."))
	ErrTimeIntervalInvalid  = errutil.BadRequest("alerting.notifications.time-intervals.invalidFormat").MustTemplate("Invalid format of the submitted time interval", errutil.WithPublic("Time interval is in invalid format. Correct the payload and try again."))
	ErrTimeIntervalInUse    = errutil.Conflict("alerting.notifications.time-intervals.used").MustTemplate("Time interval is used")

	ErrContactPointReferenced = errutil.Conflict("alerting.notifications.contact-points.referenced", errutil.WithPublicMessage("Contact point is currently referenced by a notification policy."))
	ErrContactPointUsedInRule = errutil.Conflict("alerting.notifications.contact-points.used-by-rule", errutil.WithPublicMessage("Contact point is currently used in the notification settings of one or many alert rules."))
)

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

func MakeErrTimeIntervalInUse(usedByRoutes bool, rules []models.AlertRuleKey) error {
	uids := make([]string, 0, len(rules))
	for _, key := range rules {
		uids = append(uids, key.UID)
	}
	data := make(map[string]any, 2)
	if len(uids) > 0 {
		data["UsedByRules"] = uids
	}
	if usedByRoutes {
		data["UsedByRoutes"] = true
	}

	return ErrTimeIntervalInUse.Build(errutil.TemplateData{
		Public: data,
		Error:  nil,
	})
}

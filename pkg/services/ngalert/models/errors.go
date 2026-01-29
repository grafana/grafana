package models

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	errAlertRuleConflictMsg         = "Failed to save alert rule '{{ .Public.RuleUID }}' in organization {{ .Public.OrgID }} due to conflict: {{ .Public.Error }}"
	ErrAlertRuleConflictBase        = errutil.Conflict("alerting.alert-rule.conflict").MustTemplate(errAlertRuleConflictMsg, errutil.WithPublic(errAlertRuleConflictMsg))
	ErrAlertRuleGroupNotFound       = errutil.NotFound("alerting.alert-rule.notFound")
	ErrInvalidRelativeTimeRangeBase = errutil.BadRequest("alerting.alert-rule.invalidRelativeTime").MustTemplate("Invalid alert rule query {{ .Public.RefID }}: invalid relative time range [From: {{ .Public.From }}, To: {{ .Public.To }}]")
	ErrConditionNotExistBase        = errutil.BadRequest("alerting.alert-rule.conditionNotExist").MustTemplate("Condition {{ .Public.Given }} does not exist, must be one of {{ .Public.Existing }}")
)

var (
	ErrReceiverInUse = errutil.Conflict("alerting.notifications.receivers.used").MustTemplate(
		"Receiver is used by '{{ .Public.UsedBy }}'",
		errutil.WithPublic("Receiver is used by {{ .Public.UsedBy }}"),
	)
	ErrReceiverVersionConflict = errutil.Conflict("alerting.notifications.receivers.conflict").MustTemplate(
		"Provided version '{{ .Public.Version }}' of receiver '{{ .Public.Name }}' does not match current version '{{ .Public.CurrentVersion }}'",
		errutil.WithPublic("Provided version '{{ .Public.Version }}' of receiver '{{ .Public.Name }}' does not match current version '{{ .Public.CurrentVersion }}'"),
	)

	ErrReceiverDependentResourcesProvenance = errutil.Conflict("alerting.notifications.receivers.usedProvisioned").MustTemplate(
		"Receiver cannot be renamed because it is used by provisioned {{ if .Public.UsedByRules }}alert rules{{ end }}{{ if .Public.UsedByRoutes }}{{ if .Public.UsedByRules }} and {{ end }}notification policies{{ end }}",
		errutil.WithPublic(`Receiver cannot be renamed because it is used by provisioned {{ if .Public.UsedByRules }}alert rules{{ end }}{{ if .Public.UsedByRoutes }}{{ if .Public.UsedByRules }} and {{ end }}notification policies{{ end }}. You must update those resources first using the original provision method.`),
	)

	ErrReceiverOrigin = errutil.BadRequest("alerting.notifications.receivers.originInvalid").MustTemplate(
		"Receiver '{{ .Public.Name }} cannot be {{ .Public.Action }}d because it belongs to an imported configuration.",
		errutil.WithPublic("Receiver '{{ .Public.Name }} cannot be {{ .Public.Action }}d because it belongs to an imported configuration. Finish the import of the configuration first."),
	)

	ErrReceiverNotFound = errutil.NotFound("alerting.notifications.receivers.notFound", errutil.WithPublicMessage("Receiver not found"))

	ErrReceiverExists = errutil.Conflict("alerting.notifications.receivers.exists", errutil.WithPublicMessage("Receiver with this name already exists. Use a different name or update an existing one."))

	ErrReceiverInvalidBase = errutil.BadRequest("alerting.notifications.receivers.invalid").MustTemplate(
		"Invalid receiver: '{{ .Public.Reason }}'",
		errutil.WithPublic("Invalid receiver: '{{ .Public.Reason }}'"),
	)

	ErrReceiverTestingIntegrationNotFound = errutil.NotFound("alerting.notifications.receivers.testing.integrationNotFound", errutil.WithPublicMessage("Integration not found"))

	ErrReceiverTestingInvalidIntegrationBase = errutil.BadRequest("alerting.notifications.receivers.testing.invalid").MustTemplate(
		"Invalid request to test integration: {{ .Public.Reason }}",
		errutil.WithPublic("Invalid request to test integration: {{ .Public.Reason }}"))
)

// Route errors.
var (
	ErrRouteNotFound = errutil.NotFound("alerting.notifications.routes.notFound", errutil.WithPublicMessage("Route not found"))

	ErrRouteInvalidFormat = errutil.BadRequest("alerting.notifications.routes.invalidFormat").MustTemplate(
		"Invalid format of the submitted route: {{.Public.Error}}.",
		errutil.WithPublic("Invalid format of the submitted route: {{.Public.Error}}. Correct the payload and try again."),
	)

	ErrRouteConflictingMatchers = errutil.BadRequest("alerting.notifications.routes.conflictingMatchers").MustTemplate("Routing tree conflicts with the external configuration",
		errutil.WithPublic("Cannot add\\update route: matchers conflict with an external routing tree merging matchers {{ .Public.Matchers }}, making the added\\updated route unreachable."),
	)

	ErrMultipleRoutesNotSupported = errutil.NotImplemented("alerting.notifications.routes.multipleNotSupported", errutil.WithPublicMessage(fmt.Sprintf("Multiple routes are not supported, see feature toggle %q", featuremgmt.FlagAlertingMultiplePolicies)))

	ErrVersionConflict = errutil.Conflict("alerting.notifications.routes.conflict")
	ErrRouteExists     = errutil.Conflict("alerting.notifications.routes.exists", errutil.WithPublicMessage("Route with this name already exists. Use a different name or update an existing one."))
)

func ErrAlertRuleConflict(ruleUID string, orgID int64, err error) error {
	return ErrAlertRuleConflictBase.Build(errutil.TemplateData{Public: map[string]any{"RuleUID": ruleUID, "OrgID": orgID, "Error": err.Error()}, Error: err})
}

func ErrInvalidRelativeTimeRange(refID string, rtr RelativeTimeRange) error {
	return ErrInvalidRelativeTimeRangeBase.Build(errutil.TemplateData{Public: map[string]any{"RefID": refID, "From": rtr.From, "To": rtr.To}})
}

func ErrConditionNotExist(given string, existing []string) error {
	return ErrConditionNotExistBase.Build(errutil.TemplateData{Public: map[string]any{"Given": given, "Existing": fmt.Sprintf("%v", existing)}})
}

func ErrReceiverInvalid(err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Reason": err.Error(),
		},
		Error: err,
	}
	return ErrReceiverInvalidBase.Build(data)
}

func ErrReceiverTestingInvalidIntegration(reason string) error {
	data := errutil.TemplateData{
		Public: map[string]any{
			"Reason": reason,
		},
	}
	return ErrReceiverTestingInvalidIntegrationBase.Build(data)
}

func MakeErrRouteInvalidFormat(err error) error {
	return ErrRouteInvalidFormat.Build(errutil.TemplateData{
		Public: map[string]any{
			"Error": err.Error(),
		},
		Error: err,
	})
}

func MakeErrRouteConflictingMatchers(matchers string) error {
	return ErrRouteConflictingMatchers.Build(errutil.TemplateData{
		Public: map[string]any{
			"Matchers": matchers,
		},
	})
}

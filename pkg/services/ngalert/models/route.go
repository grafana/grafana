package models

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrRouteInvalidFormat = errutil.BadRequest("alerting.notifications.routes.invalidFormat").MustTemplate(
		"Invalid format of the submitted route.",
		errutil.WithPublic("Invalid format of the submitted route: {{.Public.Error}}. Correct the payload and try again."),
	)

	ErrRouteConflictingMatchers = errutil.BadRequest("alerting.notifications.routes.conflictingMatchers").MustTemplate("Routing tree conflicts with the external configuration",
		errutil.WithPublic("Cannot add\\update route: matchers conflict with an external routing tree merging matchers {{ .Public.Matchers }}, making the added\\updated route unreachable."),
	)
)

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

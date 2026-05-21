package v1

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

const (
	errInvalidExtraConfigurationMsg = "Invalid Alertmanager configuration: {{.Public.Error}}"
)

var (
	errInvalidExtraConfigurationBase = errutil.ValidationFailed("alerting.invalidExtraConfiguration").MustTemplate(errInvalidExtraConfigurationMsg, errutil.WithPublic(errInvalidExtraConfigurationMsg))
)

func errInvalidExtraConfiguration(err error) error {
	return errInvalidExtraConfigurationBase.Build(errutil.TemplateData{Public: map[string]any{"Error": err}})
}

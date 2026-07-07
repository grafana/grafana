package v1

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

const (
	errInvalidExtraConfigurationMsg = "Invalid Alertmanager configuration: {{.Public.Error}}"
	errUnsupportedReceiverFieldsMsg = "Configuration contains receivers that cannot be converted to Grafana receivers"
)

var (
	errInvalidExtraConfigurationBase = errutil.ValidationFailed("alerting.invalidExtraConfiguration").MustTemplate(errInvalidExtraConfigurationMsg, errutil.WithPublic(errInvalidExtraConfigurationMsg))
	errUnsupportedReceiverFieldsBase = errutil.ValidationFailed("alerting.unsupportedReceiverFields").MustTemplate(errUnsupportedReceiverFieldsMsg, errutil.WithPublic(errUnsupportedReceiverFieldsMsg))
)

// unsupportedReceiverFields is one receiver's unsupported fields, serialized into
// the error's public "extra" payload.
type unsupportedReceiverFields struct {
	Receiver string   `json:"receiver"`
	Fields   []string `json:"fields"`
}

func errInvalidExtraConfiguration(err error) error {
	return errInvalidExtraConfigurationBase.Build(errutil.TemplateData{Public: map[string]any{"Error": err}})
}

func errUnsupportedReceiverFields(receivers []unsupportedReceiverFields) error {
	return errUnsupportedReceiverFieldsBase.Build(errutil.TemplateData{Public: map[string]any{
		"receivers": receivers,
	}})
}

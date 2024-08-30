package legacy_storage

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrNoAlertmanagerConfiguration  = errutil.Internal("alerting.notification.configMissing", errutil.WithPublicMessage("No alertmanager configuration present in this organization"))
	ErrBadAlertmanagerConfiguration = errutil.Internal("alerting.notification.configCorrupted").MustTemplate("Failed to unmarshal the Alertmanager configuration", errutil.WithPublic("Current Alertmanager configuration in the storage is corrupted. Reset the configuration or rollback to a recent valid one."))

	ErrReceiverNotFound = errutil.NotFound("alerting.notifications.receivers.notFound", errutil.WithPublicMessage("Receiver not found"))
	ErrReceiverExists   = errutil.Conflict("alerting.notifications.receivers.exists", errutil.WithPublicMessage("Receiver with this name already exists. Use a different name or update an existing one."))
	ErrReceiverInvalid  = errutil.BadRequest("alerting.notifications.receivers.invalid").MustTemplate(
		"Invalid receiver: '{{ .Public.Reason }}'",
		errutil.WithPublic("Invalid receiver: '{{ .Public.Reason }}'"),
	)
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

func MakeErrReceiverInvalid(err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Reason": err.Error(),
		},
		Error: err,
	}
	return ErrReceiverInvalid.Build(data)
}

package legacy_storage

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrNoAlertmanagerConfiguration  = errutil.Internal("alerting.notification.configMissing", errutil.WithPublicMessage("No alertmanager configuration present in this organization"))
	ErrBadAlertmanagerConfiguration = errutil.Internal("alerting.notification.configCorrupted").MustTemplate("Failed to unmarshal the Alertmanager configuration", errutil.WithPublic("Current Alertmanager configuration in the storage is corrupted. Reset the configuration or rollback to a recent valid one."))

	ErrReceiverNotFound = errutil.NotFound("alerting.notifications.receiver.notFound")
	ErrReceiverInUse    = errutil.Conflict("alerting.notifications.receiver.used", errutil.WithPublicMessage("Receiver is used by one or many notification policies"))
	ErrVersionConflict  = errutil.Conflict("alerting.notifications.receiver.conflict")
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

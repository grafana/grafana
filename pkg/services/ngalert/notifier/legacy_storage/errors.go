package legacy_storage

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrNoAlertmanagerConfiguration  = errutil.Internal("alerting.notification.configMissing", errutil.WithPublicMessage("No alertmanager configuration present in this organization"))
	ErrBadAlertmanagerConfiguration = errutil.Internal("alerting.notification.configCorrupted").MustTemplate("Failed to unmarshal the Alertmanager configuration", errutil.WithPublic("Current Alertmanager configuration in the storage is corrupted. Reset the configuration or rollback to a recent valid one."))

	configSizeExceededMsg             = "Aggregated notification configuration is too large ({{ .Public.Size }} bytes, limit {{ .Public.Limit }} bytes). Remove unused receivers, templates or routes and try again."
	ErrAlertmanagerConfigSizeExceeded = errutil.BadRequest("alerting.notifications.config.sizeExceeded").MustTemplate(
		configSizeExceededMsg, errutil.WithPublic(configSizeExceededMsg),
	)
)

func makeErrAlertmanagerConfigSizeExceeded(size, limit int) error {
	return ErrAlertmanagerConfigSizeExceeded.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"Size":  size,
			"Limit": limit,
		},
	})
}

func makeErrBadAlertmanagerConfiguration(err error) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Error": err.Error(),
		},
		Error: err,
	}
	return ErrBadAlertmanagerConfiguration.Build(data)
}

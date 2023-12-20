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
	ErrBadAlertmanagerConfiguration = errutil.Internal("alerting.notification.configCorrupted").MustTemplate("Failed to unmarshall the Alertmanager configuration", errutil.WithPublic("Current Alertmanager configuration in the storage is corrupted. Reset the configuration or rollback to the recent valid one."))
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

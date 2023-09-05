package notifier

import (
	"encoding/json"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TODO: We no longer do apimodels at this layer, move it to the API.
func (am *alertmanager) GetStatus() (apimodels.GettableStatus, error) {
	config := &apimodels.PostableUserConfig{}
	status := am.Base.GetStatus()
	if status == nil {
		return *apimodels.NewGettableStatus(&config.AlertmanagerConfig), nil
	}

	if err := json.Unmarshal(status, config); err != nil {
		am.logger.Error("Unable to unmarshall alertmanager config", "Err", err)
	}

	return *apimodels.NewGettableStatus(&config.AlertmanagerConfig), nil
}

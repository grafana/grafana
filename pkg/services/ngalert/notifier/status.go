package notifier

import (
	"encoding/json"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TODO: We no longer do apimodels at this layer, move it to the API.
func (am *Alertmanager) GetStatus() apimodels.GettableStatus {
	config := &apimodels.PostableApiAlertingConfig{}
	status := am.Base.GetStatus()
	if status == nil {
		return *apimodels.NewGettableStatus(config)
	}

	if err := json.Unmarshal(status, config); err != nil {
		am.logger.Error("unable to unmarshall alertmanager config", "Err", err)
	}

	return *apimodels.NewGettableStatus(config)
}

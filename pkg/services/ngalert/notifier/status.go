package notifier

import (
	"encoding/json"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TODO: We no longer do apimodels at this layer, move it to the API.
func (am *Alertmanager) GetStatus() apimodels.GettableStatus {
	config := &apimodels.PostableUserConfig{}
	if am.Base.Ready() {
		if err := json.Unmarshal(am.Base.GetStatus(), config); err != nil {
			am.logger.Error("unable to unmarshall alertmanager config", "Err", err)
		}
	}

	return *apimodels.NewGettableStatus(&config.AlertmanagerConfig)
}

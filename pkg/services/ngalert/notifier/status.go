package notifier

import (
	"encoding/json"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func (am *Alertmanager) GetStatus() apimodels.GettableStatus {
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	var amConfig apimodels.PostableApiAlertingConfig
	if am.config != nil {
		err := json.Unmarshal(am.config, &amConfig)
		if err != nil {
			// this should never error here, if the configuration is running it should be valid.
			am.logger.Error("unable to marshal alertmanager configuration", "err", err)
		}
	}
	return *apimodels.NewGettableStatus(&amConfig)
}

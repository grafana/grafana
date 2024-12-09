package notifier

import (
	"context"
	"encoding/json"
	"fmt"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TODO: We no longer do apimodels at this layer, move it to the API.
func (am *alertmanager) GetStatus(_ context.Context) (apimodels.GettableStatus, error) {
	config := &apimodels.PostableUserConfig{}
	status := am.Base.GetStatus() // TODO: This should return a GettableStatus, for now it returns PostableUserConfig.
	if status == nil {
		return *apimodels.NewGettableStatus(&config.AlertmanagerConfig), nil
	}

	if err := json.Unmarshal(status, config); err != nil {
		return apimodels.GettableStatus{}, fmt.Errorf("unable to unmarshal alertmanager config: %w", err)
	}

	return *apimodels.NewGettableStatus(&config.AlertmanagerConfig), nil
}

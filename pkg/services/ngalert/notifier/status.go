package notifier

import (
	"context"
	"encoding/json"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TODO: We no longer do apimodels at this layer, move it to the API.
func (am *alertmanager) GetStatus(_ context.Context) (apimodels.GettableStatus, error) {
	status := am.Base.AppliedConfig()
	if status == nil {
		return *apimodels.NewGettableStatus(&apimodels.PostableApiAlertingConfig{}), nil
	}

	// Prevent mutating returned config. TODO: This would be better done inside AppliedConfig.
	amConfig, err := clone(NotificationsConfigurationToPostableAPIConfig(*status))
	if err != nil {
		return apimodels.GettableStatus{}, err
	}

	return *apimodels.NewGettableStatus(&amConfig), nil
}

func clone[T any](source T) (T, error) {
	var cloned T
	raw, err := json.Marshal(source)
	if err != nil {
		return cloned, err
	}
	if err := json.Unmarshal(raw, &cloned); err != nil {
		return cloned, err
	}
	return cloned, nil
}

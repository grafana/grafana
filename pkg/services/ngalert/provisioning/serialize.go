package provisioning

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func DeserializeAlertmanagerConfig(config []byte) (*definitions.PostableUserConfig, error) {
	result := definitions.PostableUserConfig{}
	if err := json.Unmarshal(config, &result); err != nil {
		return nil, fmt.Errorf("failed to deserialize alertmanager configuration: %w", err)
	}
	return &result, nil
}

func SerializeAlertmanagerConfig(config definitions.PostableUserConfig) ([]byte, error) {
	return json.Marshal(config)
}

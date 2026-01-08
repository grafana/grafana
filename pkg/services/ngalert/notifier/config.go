package notifier

import (
	"encoding/json"
	"fmt"

	api "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func Load(rawConfig []byte) (*api.PostableUserConfig, error) {
	cfg := &api.PostableUserConfig{}

	if err := json.Unmarshal(rawConfig, cfg); err != nil {
		return nil, fmt.Errorf("unable to parse Alertmanager configuration: %w", err)
	}

	return cfg, nil
}

package notifier

import (
	"encoding/json"
	"fmt"

	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func Load(rawConfig []byte) (*v1.AMConfigV1, error) {
	cfg := &v1.AMConfigDB{}

	if err := json.Unmarshal(rawConfig, cfg); err != nil {
		return nil, fmt.Errorf("unable to parse Alertmanager configuration: %w", err)
	}

	return v1.ToModel(cfg), nil
}

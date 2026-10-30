package notifier

import (
	"encoding/json"
	"fmt"

	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1/store"
)

func Load(rawConfig []byte) (*v1.AMConfigV1, error) {
	cfg := &store.AMConfigDB{}

	if err := json.Unmarshal(rawConfig, cfg); err != nil {
		return nil, fmt.Errorf("unable to parse Alertmanager configuration: %w", err)
	}

	return v1.ToModel(cfg), nil
}

package embed

import (
	"encoding/json"

	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
)

func HasPendingDeleteLabel(value []byte) bool {
	if len(value) == 0 {
		return false
	}
	var obj struct {
		Metadata struct {
			Labels map[string]string `json:"labels"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(value, &obj); err != nil {
		return false
	}
	return obj.Metadata.Labels[controller.LabelPendingDelete] == "true"
}

package embed

import "encoding/json"

const LabelPendingDelete = "cloud.grafana.com/pending-delete"

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
	return obj.Metadata.Labels[LabelPendingDelete] == "true"
}

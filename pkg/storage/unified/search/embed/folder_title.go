package embed

import "encoding/json"

// FolderUIDFromValue reads the folder UID from the value's k8s annotation; "" for root-level or malformed values.
func FolderUIDFromValue(value []byte) string {
	var obj struct {
		Metadata struct {
			Annotations map[string]string `json:"annotations"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(value, &obj); err != nil {
		return ""
	}
	return obj.Metadata.Annotations["grafana.app/folder"]
}

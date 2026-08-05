package embed

import "encoding/json"

// FolderUIDFromValue reads the folder UID a resource belongs to from the k8s
// annotation on its raw stored value. Returns "" if the value is malformed or
// carries no folder (root-level resources).
//
// The title-resolution counterpart to this (foldertitle.Resolver) lives in
// its own subpackage rather than here: pkg/storage/unified/resource defines
// resource.StorageBackend and depends on this package transitively via
// embedder, so this package can't import resource without cycling.
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

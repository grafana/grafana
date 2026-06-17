package embed

import "encoding/json"

// LabelPendingDelete marks a resource whose tenant is pending deletion. The
// tenant watcher (resource.TenantWatcher) adds this label to every resource
// when a tenant is marked for deletion and removes it on restore. This mirrors
// the watcher's internal labelPendingDelete constant — keep the two in sync.
const LabelPendingDelete = "cloud.grafana.com/pending-delete"

// HasPendingDeleteLabel reports whether the stored resource value carries the
// pending-delete label. Reading the label off the resource itself — rather
// than a separate per-tenant lookup — means a restore re-embeds for free: the
// watcher clears the label and emits a MODIFIED event whose value no longer
// has it, so the resource embeds again on its own.
//
// Fails open: an empty or unparseable value returns false so we embed rather
// than silently drop content.
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

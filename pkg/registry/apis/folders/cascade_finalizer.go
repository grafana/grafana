package folders

import (
	"slices"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// The cascade-delete finalizer is server-owned: the cascade controller relies on it being present
// exactly on folders created while the flag was on. A client that adds it would get a folder stuck
// terminating; one that drops it would skip the cascade and orphan the folder's contents.

// applyCascadeDeleteFinalizerOnCreate stamps the finalizer when enabled and otherwise strips any
// client-sent copy, so a flag-off create is identical to one without this feature.
func applyCascadeDeleteFinalizerOnCreate(f *foldersv1.Folder, enabled bool) {
	setCascadeDeleteFinalizer(f, enabled)
}

// preserveCascadeDeleteFinalizerOnUpdate makes the incoming update f carry the same cascade
// finalizer state as the stored folder old, whatever the client sent:
//   - stored folder has it: it is put back if the client left it out. PUT replaces metadata
//     wholesale, so clients that replay whole objects (Terraform, export/import, provisioning) or
//     send "finalizers": null would otherwise drop it and the folder would later be deleted
//     without its cascade.
//   - stored folder lacks it: it is stripped if the client added it. Only a flag-on create may
//     stamp it; adding it later would backfill folders and leave them stuck terminating.
//   - stored folder has it and is terminating: the client's finalizers are left as sent, so the
//     finalizer may be removed. This is the only way it goes away, and how the cascade controller
//     releases the folder once its descendants are gone.
//
// The state is read from old, not f, because f is client input: its finalizers and deletion
// timestamp are exactly what is being guarded. Mismatches are corrected silently rather than
// rejected so those whole-object clients keep working.
func preserveCascadeDeleteFinalizerOnUpdate(f, old *foldersv1.Folder) {
	had := slices.Contains(old.Finalizers, foldersv1.CascadeDeleteFinalizer)
	if had && old.DeletionTimestamp != nil {
		return
	}
	setCascadeDeleteFinalizer(f, had)
}

func setCascadeDeleteFinalizer(f *foldersv1.Folder, present bool) {
	has := slices.Contains(f.Finalizers, foldersv1.CascadeDeleteFinalizer)
	switch {
	case present && !has:
		f.Finalizers = append(f.Finalizers, foldersv1.CascadeDeleteFinalizer)
	case !present && has:
		f.Finalizers = slices.DeleteFunc(f.Finalizers, func(s string) bool { return s == foldersv1.CascadeDeleteFinalizer })
		if len(f.Finalizers) == 0 {
			f.Finalizers = nil
		}
	}
}

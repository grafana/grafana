package resourcepermission

// MergeDefaultPermissions returns current, the spec.permissions of an existing
// ResourcePermission (nil when there is none yet), plus every default whose
// subject (kind+name) has no entry in it. Existing entries are never removed
// or changed, so a subject that already has a grant keeps it even when the
// default for that subject differs. The returned slice only holds plain JSON
// types so it can be stored in an unstructured object as-is. changed reports
// whether anything was added.
func MergeDefaultPermissions(current []any, defaults []map[string]any) (merged []any, changed bool) {
	have := make(map[[2]string]bool, len(current))
	merged = make([]any, 0, len(current)+len(defaults))
	for _, p := range current {
		entry, ok := p.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := entry["kind"].(string)
		name, _ := entry["name"].(string)
		have[[2]string{kind, name}] = true
		merged = append(merged, entry)
	}
	for _, d := range defaults {
		kind, _ := d["kind"].(string)
		name, _ := d["name"].(string)
		if have[[2]string{kind, name}] {
			continue
		}
		merged = append(merged, d)
		changed = true
	}
	return merged, changed
}

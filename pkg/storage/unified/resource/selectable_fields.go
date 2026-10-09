package resource

// SelectableFields returns a map keyed by (group, kind) to the list of
// selectable fields for known manifests.
func SelectableFields() map[LowerGroupResource][]string {
	return SelectableFieldsForManifests(AppManifests()...)
}

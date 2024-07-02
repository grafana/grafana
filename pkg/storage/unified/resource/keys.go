package resource

func matchesQueryKey(query *ResourceKey, key *ResourceKey) bool {
	if query.Group != key.Group {
		return false
	}
	if query.Resource != key.Resource {
		return false
	}
	if query.Namespace != "" && query.Namespace != key.Namespace {
		return false
	}
	if query.Name != "" && query.Name != key.Name {
		return false
	}
	return true
}

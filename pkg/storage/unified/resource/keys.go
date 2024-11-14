package resource

func verifyRequestKey(key *ResourceKey) *ErrorResult {
	if key == nil {
		return NewBadRequestError("missing resource key")
	}
	if key.Group == "" {
		return NewBadRequestError("request key is missing group")
	}
	if key.Resource == "" {
		return NewBadRequestError("request key is missing resource")
	}
	return nil
}

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

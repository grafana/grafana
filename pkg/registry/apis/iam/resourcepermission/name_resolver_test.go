package resourcepermission

import (
	"context"
	"errors"
	"maps"
)

// mockNameResolver is a test double for NameResolver.
// All methods return the mapped value, or the configured error if set.
type mockNameResolver struct {
	uidToID       map[string]string
	idToUID       map[string]string
	uidToIDErr    error
	idToUIDErr    error
	idToUIDMapErr error
}

func (m *mockNameResolver) UIDToID(_ context.Context, _, uid string) (string, error) {
	if m.uidToIDErr != nil {
		return "", m.uidToIDErr
	}
	if id, ok := m.uidToID[uid]; ok {
		return id, nil
	}
	return "", errors.New("uid not found: " + uid)
}

func (m *mockNameResolver) IDToUID(_ context.Context, _, id string) (string, error) {
	if m.idToUIDErr != nil {
		return "", m.idToUIDErr
	}
	if uid, ok := m.idToUID[id]; ok {
		return uid, nil
	}
	return "", errors.New("id not found: " + id)
}

func (m *mockNameResolver) IDToUIDMap(_ context.Context, _ string) (map[string]string, error) {
	if m.idToUIDMapErr != nil {
		return nil, m.idToUIDMapErr
	}
	return maps.Clone(m.idToUID), nil
}

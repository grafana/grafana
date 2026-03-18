package features

import (
	"context"
)

// NoopCollabService is a no-op implementation of CollabService used when no
// real collaboration backend is wired in.
type NoopCollabService struct{}

// ProvideNoopCollabService is a Wire provider for a no-op CollabService.
func ProvideNoopCollabService() CollabService {
	return &NoopCollabService{}
}

func (s *NoopCollabService) UserJoin(_ context.Context, _, _, _, _, _ string) (*CollabSessionInfo, error) {
	return &CollabSessionInfo{
		Users: []CollabUserInfo{},
		Locks: make(map[string]string),
	}, nil
}

func (s *NoopCollabService) UserLeave(_ context.Context, _, _, _ string) error {
	return nil
}

func (s *NoopCollabService) ProcessMessage(_ context.Context, _, _ string, data []byte, _ string) ([]byte, error) {
	return data, nil
}

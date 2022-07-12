package userauthimpl

import "context"

type Service struct {
	store store
}

func (s *Service) DeleteUserAuth(ctx context.Context, userID int64) error {
	return s.store.DeleteUserAuth(ctx, userID)
}

func (s *Service) DeleteUserAuthToken(ctx context.Context, userID int64) error {
	return s.store.DeleteUserAuthToken(ctx, userID)
}

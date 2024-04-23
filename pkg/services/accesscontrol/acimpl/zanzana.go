package acimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
)

// Unoptimized code to sync tuples of user data with the database.
func (s *Service) synchronizeUserData(ctx context.Context) error {
	db, ok := s.store.(*database.AccessControlStore)
	if !ok {
		return errors.New("store is not an AccessControlStore")
	}

	return db.SynchronizeUserData(ctx, s.zanzana)
}

package acimpl

import (
	"errors"

	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
)

// Unoptimized code to sync tuples of user data with the database.
func (s *Service) synchronizeUserData() error {
	db, ok := s.store.(*database.AccessControlStore)
	if !ok {
		return errors.New("store is not an AccessControlStore")
	}

	db.SynchronizeUserData(s.zanzana)
	return nil
}

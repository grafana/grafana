package acimpl

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
)

// Unoptimized code to sync tuples of user data with the database.
func (s *Service) synchronizeUserData(ctx context.Context) error {
	db, ok := s.store.(*database.AccessControlStore)
	if !ok {
		return errors.New("store is not an AccessControlStore")
	}

	err := db.SynchronizeUserData(ctx, s.zanzana)
	if err != nil {
		if strings.Contains(err.Error(), "cannot write a tuple which already exists") {
			// Ignore the error if it's a duplicate key error
			err = nil
			s.log.Warn("Ignoring duplicate key error while synchronizing user data. Can't run this migration twice", "error", err)
	}
	return err
}

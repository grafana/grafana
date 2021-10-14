package database

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(sqlStore *sqlstore.SQLStore) *AccessControlStore {
	return &AccessControlStore{sqlStore}
}

type AccessControlStore struct {
	sql *sqlstore.SQLStore
}

func deletePermissions(sess *sqlstore.DBSession, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	rawSQL := "DELETE FROM permission WHERE id IN(?" + strings.Repeat(",?", len(ids)-1) + ")"
	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, rawSQL)
	for _, id := range ids {
		args = append(args, id)
	}

	_, err := sess.Exec(args...)
	if err != nil {
		return err
	}

	return nil
}

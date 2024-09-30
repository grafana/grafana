package store

import (
	"context"
	"errors"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type Permission struct {
	Action string
	Scope  string
}

type ListPermissionsQuery struct {
	UserID int64
	Roles  []string
	Teams  []int64
	// Action to list permissions for
	Action string
}

type ListPermissionsResult struct {
	Items []accesscontrol.Permission
}

type PermissionFilter struct {
	Action string
}

func (s *Store) ListPermissions(ctx context.Context, ns claims.NamespaceInfo, q ListPermissionsQuery) (*ListPermissionsResult, error) {
	if ns.OrgID == 0 {
		return nil, errors.New("expected non zero org id")
	}

	var result ListPermissionsResult
	if q.UserID == 0 && len(q.Teams) == 0 && len(q.Roles) == 0 {
		// no permission to fetch
		return &result, nil
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	sql.DB.WithDbSession(ctx, func(sess *db.Session) error {
		filter, params := accesscontrol.UserRolesFilter(ns.OrgID, q.UserID, q.Teams, q.Roles)

		query := `
		SELECT
			p.action,
			p.scope
			FROM permission AS p
			INNER JOIN role ON role.id = p.role_id
		` + filter

		if q.Action != "" {
			query += " WHERE p.action = ?"
			params = append(params, q.Action)
		}

		if err := sess.SQL(query, params...).Find(&result.Items); err != nil {
			return err
		}

		return nil
	})

	return &result, nil
}

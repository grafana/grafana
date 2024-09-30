package legacy

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type GetIdentityQuery struct {
	// ID is a typed id
	ID string
}

type Identity struct {
	UserID int64
	Teams  []int64
	Roles  []string
}

type GetIdentityResult struct {
	Identity Identity
}

func (s *Store) GetIdentity(ctx context.Context, ns claims.NamespaceInfo, q GetIdentityQuery) (*GetIdentityResult, error) {
	if ns.OrgID < 1 {
		return nil, errors.New("expected non zero org id")
	}

	typ, id, err := identity.ParseTypeAndID(q.ID)
	if err != nil {
		return nil, err
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	dialect := sql.DB.GetDialect()

	var ident Identity
	if claims.IsIdentityType(typ, claims.TypeUser) {
		ident.UserID, err = strconv.ParseInt(id, 10, 64)
		if err != nil {
			return nil, err
		}

		err := sql.DB.WithDbSession(ctx, func(sess *db.Session) error {
			// resolve teams for user
			err = sess.SQL(
				"SELECT id FROM team AS t INNER JOIN team_member AS tm ON tm.team_id = t.id WHERE tm.user_id = ? AND tm.org_id = ?",
				ident.UserID,
				ns.OrgID,
			).Find(&ident.Teams)

			if err != nil {
				return err
			}

			roles, err := getUserRoles(sess, dialect, ns.OrgID, ident.UserID)
			if err != nil {
				return fmt.Errorf("failed to resolve role: %w", err)
			}

			ident.Roles = roles
			return nil
		})

		if err != nil {
			return nil, err
		}

		return &GetIdentityResult{Identity: ident}, nil
	}

	if claims.IsIdentityType(typ, claims.TypeServiceAccount) {
		ident.UserID, err = strconv.ParseInt(id, 10, 64)
		if err != nil {
			return nil, err
		}

		err := sql.DB.WithDbSession(ctx, func(sess *db.Session) error {
			roles, err := getUserRoles(sess, dialect, ns.OrgID, ident.UserID)
			if err != nil {
				return fmt.Errorf("failed to resolve role: %w", err)
			}

			ident.Roles = roles
			return nil
		})

		if err != nil {
			return nil, err
		}

		return &GetIdentityResult{Identity: ident}, nil
	}

	// FIXME: resolve other identities?
	return nil, fmt.Errorf("unsupported identity: %s", typ)
}

// getUserRoles resolved org role + grafana admin for users and service accounts
func getUserRoles(sess *db.Session, dialect migrator.Dialect, orgID int64, id int64) ([]string, error) {
	type user struct {
		IsAdmin bool
		Role    string
	}

	var u user
	// resolve role for user
	err := sess.SQL(
		"SELECT u.is_admin, ou.role FROM "+dialect.Quote("user")+" AS u INNER JOIN org_user AS ou ON u.id = ou.user_id WHERE u.id = ? AND ou.org_id = ?",
		id,
		orgID,
	).Find(&u)

	if err != nil {
		return nil, err
	}

	// FIXME: reuse logic in accesscontrol.GetOrgRoles ?
	roles := make([]string, 0, 2)
	roles = append(roles, u.Role)
	if u.IsAdmin {
		roles = append(roles, accesscontrol.RoleGrafanaAdmin)
	}

	return roles, nil
}

package pulse

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

// hookStore wraps the SQL operations for Pulse hooks. It shares the
// underlying *store's db handle but lives on its own type so the hook
// CRUD surface stays readable next to the larger thread/pulse store.
type hookStore struct {
	sql db.DB
}

func newHookStore(sql db.DB) *hookStore {
	return &hookStore{sql: sql}
}

// insertHook writes a new hook row. Name uniqueness is enforced by a
// unique (org_id, name) index; we pre-check inside the transaction to
// return a friendly typed error rather than leaking a driver-specific
// constraint violation, while the index remains the source of truth
// against a race.
func (s *hookStore) insertHook(ctx context.Context, h *Hook) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		exists, err := hookNameTaken(sess, h.OrgID, h.Name, "")
		if err != nil {
			return err
		}
		if exists {
			return ErrHookNameDuplicate
		}
		if _, err := sess.Insert(h); err != nil {
			// A concurrent insert can still beat the pre-check to the
			// unique index; surface the same friendly error.
			if isUniqueConstraintErr(err) {
				return ErrHookNameDuplicate
			}
			return err
		}
		return nil
	})
}

// updateHook updates an existing hook in place. secret==nil leaves the
// stored secret untouched; a non-nil pointer (including "") overwrites
// it, so the edit form can clear a secret by sending an empty string.
func (s *hookStore) updateHook(ctx context.Context, orgID int64, uid string, name string, typ HookType, url string, disabled bool, secret *string) (Hook, error) {
	var out Hook
	err := s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var existing Hook
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&existing)
		if err != nil {
			return err
		}
		if !ok {
			return ErrHookNotFound
		}
		taken, err := hookNameTaken(sess, orgID, name, uid)
		if err != nil {
			return err
		}
		if taken {
			return ErrHookNameDuplicate
		}
		existing.Name = name
		existing.Type = typ
		existing.URL = url
		existing.Disabled = disabled
		existing.Updated = time.Now().UTC()
		cols := []string{"name", "type", "url", "disabled", "updated"}
		if secret != nil {
			existing.Secret = *secret
			cols = append(cols, "secret")
		}
		// disabled is a bool that can transition true->false; xorm's
		// struct Update elides false bools, so MustCols forces the
		// column into the UPDATE list regardless of value.
		if _, err := sess.ID(existing.ID).Cols(cols...).MustCols("disabled").Update(&existing); err != nil {
			if isUniqueConstraintErr(err) {
				return ErrHookNameDuplicate
			}
			return err
		}
		out = existing
		return nil
	})
	return out, err
}

func (s *hookStore) deleteHook(ctx context.Context, orgID int64, uid string) error {
	return s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		affected, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Delete(&Hook{})
		if err != nil {
			return err
		}
		if affected == 0 {
			return ErrHookNotFound
		}
		return nil
	})
}

func (s *hookStore) getHookByUID(ctx context.Context, orgID int64, uid string) (Hook, error) {
	var h Hook
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&h)
		if err != nil {
			return err
		}
		if !ok {
			return ErrHookNotFound
		}
		return nil
	})
	return h, err
}

func (s *hookStore) listHooks(ctx context.Context, orgID int64) ([]Hook, error) {
	hooks := make([]Hook, 0)
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("org_id = ?", orgID).OrderBy("LOWER(name) ASC").Find(&hooks)
	})
	if err != nil {
		return nil, err
	}
	return hooks, nil
}

// listHooksByUIDs resolves a set of hook UIDs to their rows, dropping
// disabled hooks. Powers webhook dispatch: the dispatcher passes the
// UIDs pulled from a pulse's webhook mentions and gets back only the
// hooks that should actually fire.
func (s *hookStore) listHooksByUIDs(ctx context.Context, orgID int64, uids []string) ([]Hook, error) {
	if len(uids) == 0 {
		return nil, nil
	}
	hooks := make([]Hook, 0, len(uids))
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("org_id = ? AND disabled = ?", orgID, false).In("uid", uids).Find(&hooks)
	})
	if err != nil {
		return nil, err
	}
	return hooks, nil
}

// listMentionableHooks returns enabled hooks matching the query,
// capped at limit and ordered by name. Empty query returns the first
// `limit` hooks so a freshly-typed `@` can still surface options.
func (s *hookStore) listMentionableHooks(ctx context.Context, q MentionableHooksQuery) ([]Hook, error) {
	limit := q.Limit
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	hooks := make([]Hook, 0, limit)
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		sb := sess.Where("org_id = ? AND disabled = ?", q.OrgID, false)
		if needle := strings.TrimSpace(q.Query); needle != "" {
			sb = sb.And("LOWER(name) LIKE ?", "%"+strings.ToLower(needle)+"%")
		}
		return sb.OrderBy("LOWER(name) ASC").Limit(limit).Find(&hooks)
	})
	if err != nil {
		return nil, err
	}
	return hooks, nil
}

// hookNameTaken reports whether another hook in the org already uses
// name (case-insensitive). excludeUID lets update skip the row being
// edited so renaming a hook to its own name isn't a conflict.
func hookNameTaken(sess *db.Session, orgID int64, name, excludeUID string) (bool, error) {
	var existing Hook
	sb := sess.Where("org_id = ? AND LOWER(name) = ?", orgID, strings.ToLower(strings.TrimSpace(name)))
	if excludeUID != "" {
		sb = sb.And("uid <> ?", excludeUID)
	}
	return sb.Get(&existing)
}

// isUniqueConstraintErr does a best-effort, driver-agnostic check for a
// unique-index violation so a create/update racing the pre-check still
// returns ErrHookNameDuplicate instead of a raw SQL error. The message
// substrings cover SQLite, MySQL and Postgres.
func isUniqueConstraintErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate")
}

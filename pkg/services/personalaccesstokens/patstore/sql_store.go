package patstore

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util"
)

type sqlStore struct {
	db  db.DB
	now func() time.Time
}

func ProvideStore(db db.DB) Store {
	return &sqlStore{db: db, now: time.Now}
}

func (s *sqlStore) Create(ctx context.Context, cmd CreateCommand) (*Token, error) {
	now := s.now().UTC()
	t := &Token{
		UID:        util.GenerateShortUID(),
		UserID:     cmd.UserID,
		OrgID:      cmd.OrgID,
		Name:       cmd.Name,
		TokenHash:  cmd.TokenHash,
		PrefixHint: cmd.PrefixHint,
		Scopes:     cmd.Scopes,
		ExpiresAt:  cmd.ExpiresAt,
		CreatedAt:  now,
		CreatedIP:  cmd.CreatedIP,
	}
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(t)
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("insert personal access token: %w", err)
	}
	return t, nil
}

func (s *sqlStore) GetByHash(ctx context.Context, hash string) (*Token, error) {
	var t Token
	var found bool
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Where("token_hash = ?", hash).Get(&t)
		return err
	})
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrNotFound
	}
	return &t, nil
}

func (s *sqlStore) GetByUID(ctx context.Context, uid string) (*Token, error) {
	var t Token
	var found bool
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Where("uid = ?", uid).Get(&t)
		return err
	})
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrNotFound
	}
	return &t, nil
}

var likeEscaper = strings.NewReplacer("!", "!!", "%", "!%", "_", "!_")

func (s *sqlStore) Search(ctx context.Context, q SearchQuery) (*SearchResult, error) {
	now := s.now().UTC()
	where := []string{"1 = 1"}
	args := []any{}
	if q.OrgID != 0 {
		where = append(where, "t.org_id = ?")
		args = append(args, q.OrgID)
	}
	if q.UserID != 0 {
		where = append(where, "t.user_id = ?")
		args = append(args, q.UserID)
	}
	switch q.Status {
	case StatusActive:
		where = append(where, "t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > ?)")
		args = append(args, now)
	case StatusExpired:
		where = append(where, "t.revoked_at IS NULL AND t.expires_at IS NOT NULL AND t.expires_at <= ?")
		args = append(args, now)
	case StatusRevoked:
		where = append(where, "t.revoked_at IS NOT NULL")
	}
	if q.ExpiringBefore != nil {
		where = append(where, "t.expires_at IS NOT NULL AND t.expires_at < ?")
		args = append(args, q.ExpiringBefore.UTC())
	}
	if q.Query != "" {
		like := "%" + likeEscaper.Replace(strings.ToLower(q.Query)) + "%"
		where = append(where, "(LOWER(t.name) LIKE ? ESCAPE '!' OR LOWER(u.login) LIKE ? ESCAPE '!' OR LOWER(u.email) LIKE ? ESCAPE '!' OR LOWER(u.name) LIKE ? ESCAPE '!')")
		args = append(args, like, like, like, like)
	}
	from := " FROM personal_access_token t LEFT JOIN " + s.db.GetDialect().Quote("user") + " u ON u.id = t.user_id LEFT JOIN org o ON o.id = t.org_id WHERE " + strings.Join(where, " AND ")

	limit, page := q.Limit, q.Page
	if limit <= 0 || limit > 1000 {
		limit = 50
	}
	if page <= 0 {
		page = 1
	}
	res := &SearchResult{Tokens: []*TokenWithOwner{}}
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.SQL("SELECT COUNT(*)"+from, args...).Get(&res.Total); err != nil {
			return err
		}
		cols := "SELECT t.*, u.login AS owner_login, u.email AS owner_email, u.name AS owner_name, o.name AS org_name"
		orderBy, orderArgs := orderClause(q, now)
		queryArgs := append(append(args, orderArgs...), limit, (page-1)*limit)
		return sess.SQL(cols+from+" ORDER BY "+orderBy+" LIMIT ? OFFSET ?", queryArgs...).Find(&res.Tokens)
	})
	return res, err
}

func (s *sqlStore) ListByUser(ctx context.Context, userID, orgID int64) ([]*Token, error) {
	res := make([]*Token, 0)
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("user_id = ? AND org_id = ?", userID, orgID).Asc("created_at", "id").Find(&res)
	})
	return res, err
}

func (s *sqlStore) CountActiveByUser(ctx context.Context, userID, orgID int64) (int64, error) {
	var n int64
	now := s.now().UTC()
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		n, err = sess.Where("user_id = ? AND org_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)",
			userID, orgID, now).Count(&Token{})
		return err
	})
	return n, err
}

func (s *sqlStore) Revoke(ctx context.Context, orgID, userID int64, uid, reason string) error {
	now := s.now().UTC()
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec("UPDATE personal_access_token SET revoked_at = ?, revoked_reason = ? "+
			"WHERE uid = ? AND org_id = ? AND user_id = ? AND revoked_at IS NULL", now, reason, uid, orgID, userID)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func (s *sqlStore) ListActive(ctx context.Context) ([]*Token, error) {
	out := []*Token{}
	now := s.now().UTC()
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)", now).Find(&out)
	})
	return out, err
}

func (s *sqlStore) RevokeByID(ctx context.Context, id int64, reason string) error {
	now := s.now().UTC()
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec("UPDATE personal_access_token SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL", now, reason, id)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func (s *sqlStore) RevokeAllForUser(ctx context.Context, userID int64, reason string) (int64, error) {
	return s.revokeAll(ctx, "user_id = ?", []any{userID}, reason)
}

func (s *sqlStore) RevokeAllForUserInOrg(ctx context.Context, userID, orgID int64, reason string) (int64, error) {
	return s.revokeAll(ctx, "user_id = ? AND org_id = ?", []any{userID, orgID}, reason)
}

func (s *sqlStore) RevokeAll(ctx context.Context, reason string) (int64, error) {
	return s.revokeAll(ctx, "1 = 1", nil, reason)
}

func (s *sqlStore) RevokeAllInOrg(ctx context.Context, orgID int64, reason string) (int64, error) {
	return s.revokeAll(ctx, "org_id = ?", []any{orgID}, reason)
}

func (s *sqlStore) revokeAll(ctx context.Context, where string, args []any, reason string) (int64, error) {
	now := s.now().UTC()
	var n int64
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		params := append([]any{"UPDATE personal_access_token SET revoked_at = ?, revoked_reason = ? WHERE revoked_at IS NULL AND " + where, now, reason}, args...)
		res, err := sess.Exec(params...)
		if err != nil {
			return err
		}
		n, err = res.RowsAffected()
		return err
	})
	return n, err
}

func (s *sqlStore) TouchLastUsed(ctx context.Context, id int64, info UsageInfo) error {
	now := s.now().UTC()
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE personal_access_token SET last_used_at = ?, last_used_ip = ?, last_used_ua = ? WHERE id = ?",
			now, truncate(info.IP, 64), truncate(info.UserAgent, 255), id)
		return err
	})
}

func (s *sqlStore) DeleteInactiveBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	var n int64
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err := sess.Exec("DELETE FROM personal_access_token WHERE (revoked_at IS NOT NULL AND revoked_at < ?) OR (expires_at IS NOT NULL AND expires_at < ?)",
			cutoff.UTC(), cutoff.UTC())
		if err != nil {
			return err
		}
		n, err = res.RowsAffected()
		return err
	})
	return n, err
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// orderClause builds an ORDER BY from a fixed whitelist so user input never reaches the SQL text.
func orderClause(q SearchQuery, now time.Time) (string, []any) {
	dir := "ASC"
	if q.SortDesc {
		dir = "DESC"
	}
	nullsLast := func(col string) string {
		return "CASE WHEN " + col + " IS NULL THEN 1 ELSE 0 END ASC, " + col + " " + dir
	}
	var primary string
	var args []any
	switch q.SortBy {
	case "name":
		primary = "LOWER(t.name) " + dir
	case "owner":
		primary = "LOWER(u.login) " + dir
	case "org":
		primary = "LOWER(o.name) " + dir
	case "created":
		primary = "t.created_at " + dir
	case "expires":
		primary = nullsLast("t.expires_at")
	case "lastUsed":
		primary = nullsLast("t.last_used_at")
	case "status":
		// active < expired < revoked
		primary = "CASE WHEN t.revoked_at IS NOT NULL THEN 2 WHEN t.expires_at IS NOT NULL AND t.expires_at <= ? THEN 1 ELSE 0 END " + dir
		args = append(args, now)
	case "scopes":
		primary = "LENGTH(t.scopes) " + dir
	default:
		return "t.created_at DESC, t.id DESC", nil
	}
	return primary + ", t.id DESC", args
}

package pulse

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

// store wraps the SQL operations for Pulse. It is intentionally separate
// from the service so that tests can fake one without the other.
type store struct {
	sql db.DB
}

func newStore(sql db.DB) *store {
	return &store{sql: sql}
}

// cursor is the opaque pagination cursor we return to clients. It's
// base64-JSON, not a sealed token: clients should not try to parse it but
// the server must accept whatever it last produced.
type cursor struct {
	Created string `json:"c"`
	UID     string `json:"u"`
	ID      int64  `json:"i,omitempty"`
}

func encodeCursor(c cursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(s string) (cursor, error) {
	if s == "" {
		return cursor{}, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return cursor{}, fmt.Errorf("invalid cursor: %w", err)
	}
	var c cursor
	if err := json.Unmarshal(raw, &c); err != nil {
		return cursor{}, fmt.Errorf("invalid cursor: %w", err)
	}
	return c, nil
}

// insertThreadAndPulse atomically writes a new thread row plus its first
// pulse and any mention rows. Done in a single transaction so a thread is
// never observed without its parent pulse.
func (s *store) insertThreadAndPulse(ctx context.Context, t Thread, p Pulse, mentions []Mention) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		if _, err := sess.Insert(&p); err != nil {
			return err
		}
		return s.insertMentions(sess, p, mentions)
	})
}

// insertPulse appends a pulse to an existing thread, denormalizes thread
// counters, and writes mention rows. All in one transaction.
func (s *store) insertPulse(ctx context.Context, p Pulse, mentions []Mention) (Thread, error) {
	var thread Thread
	err := s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		ok, err := sess.Where("org_id = ? AND uid = ?", p.OrgID, p.ThreadUID).Get(&thread)
		if err != nil {
			return err
		}
		if !ok {
			return ErrThreadNotFound
		}
		if p.ParentUID != "" && p.ParentUID != thread.UID {
			// Validate parent belongs to this thread and is not deleted.
			// Use a fresh struct each time (xorm Get hydrates in place; a
			// stale struct can pick up zero values for cols outside the
			// where clause).
			parent := Pulse{}
			pok, err := sess.Where("org_id = ? AND uid = ?", p.OrgID, p.ParentUID).Get(&parent)
			if err != nil {
				return err
			}
			if !pok {
				return ErrParentPulseMismatch
			}
			if parent.ThreadUID != thread.UID {
				return ErrParentPulseMismatch
			}
			if parent.Deleted {
				return ErrParentPulseDeleted
			}
		}
		if _, err := sess.Insert(&p); err != nil {
			return err
		}

		// xorm auto-increments columns named "version" on every Update,
		// so we deliberately do NOT manually ++ here. We update the other
		// counters and let xorm bump version atomically as part of the
		// same write.
		thread.LastPulseAt = p.Created
		thread.PulseCount++
		thread.Updated = p.Created
		if _, err := sess.ID(thread.ID).Cols("last_pulse_at", "pulse_count", "updated").Update(&thread); err != nil {
			return err
		}
		// Re-read the now-bumped version so callers get the canonical value.
		if _, err := sess.ID(thread.ID).Get(&thread); err != nil {
			return err
		}
		return s.insertMentions(sess, p, mentions)
	})
	return thread, err
}

func (s *store) insertMentions(sess *db.Session, p Pulse, mentions []Mention) error {
	if len(mentions) == 0 {
		return nil
	}
	rows := make([]MentionRow, 0, len(mentions))
	for _, m := range mentions {
		rows = append(rows, MentionRow{
			PulseUID:  p.UID,
			ThreadUID: p.ThreadUID,
			OrgID:     p.OrgID,
			Kind:      m.Kind,
			TargetID:  m.TargetID,
			Created:   p.Created,
		})
	}
	_, err := sess.Insert(&rows)
	return err
}

// getThreadByUID is the canonical thread fetch.
func (s *store) getThreadByUID(ctx context.Context, orgID int64, uid string) (Thread, error) {
	var t Thread
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&t)
		if err != nil {
			return err
		}
		if !ok {
			return ErrThreadNotFound
		}
		return nil
	})
	return t, err
}

// getPulseByUID returns a single pulse by UID inside an org.
func (s *store) getPulseByUID(ctx context.Context, orgID int64, uid string) (Pulse, error) {
	var p Pulse
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&p)
		if err != nil {
			return err
		}
		if !ok {
			return ErrPulseNotFound
		}
		return nil
	})
	return p, err
}

// listThreads returns the most-recently-active threads for a resource. The
// caller is responsible for already authorizing access to the parent
// resource (we trust that here and only filter by org).
func (s *store) listThreads(ctx context.Context, q ListThreadsQuery) (PageResult[Thread], error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 50
	}

	c, err := decodeCursor(q.Cursor)
	if err != nil {
		return PageResult[Thread]{}, err
	}

	threads := make([]Thread, 0, q.Limit+1)
	err = s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		sb := sess.Where("org_id = ? AND resource_kind = ? AND resource_uid = ?", q.OrgID, q.ResourceKind, q.ResourceUID)
		if q.PanelID != nil {
			sb = sb.And("panel_id = ?", *q.PanelID)
		}
		if c.Created != "" {
			sb = sb.And("(last_pulse_at < ? OR (last_pulse_at = ? AND uid < ?))", c.Created, c.Created, c.UID)
		}
		return sb.OrderBy("last_pulse_at DESC, uid DESC").Limit(q.Limit + 1).Find(&threads)
	})
	if err != nil {
		return PageResult[Thread]{}, err
	}

	res := PageResult[Thread]{Items: threads}
	if len(threads) > q.Limit {
		res.HasMore = true
		last := threads[q.Limit-1]
		res.Items = threads[:q.Limit]
		res.NextCursor = encodeCursor(cursor{
			Created: last.LastPulseAt.UTC().Format(time.RFC3339Nano),
			UID:     last.UID,
		})
	}
	return res, nil
}

// listPulses returns the pulses inside a thread, oldest first.
func (s *store) listPulses(ctx context.Context, q ListPulsesQuery) (PageResult[Pulse], error) {
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 100
	}
	c, err := decodeCursor(q.Cursor)
	if err != nil {
		return PageResult[Pulse]{}, err
	}

	pulses := make([]Pulse, 0, q.Limit+1)
	err = s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		sb := sess.Where("org_id = ? AND thread_uid = ?", q.OrgID, q.ThreadUID)
		if c.Created != "" {
			// id is the monotonic tiebreaker: SQLite stores DATETIME with
			// second precision, so two pulses created in the same second
			// would otherwise sort by uid (random) and break replay order.
			sb = sb.And("(created > ? OR (created = ? AND id > ?))", c.Created, c.Created, c.ID)
		}
		return sb.OrderBy("created ASC, id ASC").Limit(q.Limit + 1).Find(&pulses)
	})
	if err != nil {
		return PageResult[Pulse]{}, err
	}

	res := PageResult[Pulse]{Items: pulses}
	if len(pulses) > q.Limit {
		res.HasMore = true
		last := pulses[q.Limit-1]
		res.Items = pulses[:q.Limit]
		res.NextCursor = encodeCursor(cursor{
			Created: last.Created.UTC().Format(time.RFC3339Nano),
			UID:     last.UID,
			ID:      last.ID,
		})
	}
	return res, nil
}

// updatePulseBody updates body_text + body_json + edited flag. Mention rows
// are rewritten to match the new body so notifications on edit fire only
// for newly added mentions (the service decides which subset to notify).
func (s *store) updatePulseBody(ctx context.Context, p Pulse, mentions []Mention) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		updated, err := sess.ID(p.ID).Cols("body_text", "body_json", "updated", "edited").Update(&p)
		if err != nil {
			return err
		}
		if updated == 0 {
			return ErrPulseNotFound
		}
		if _, err := sess.Where("pulse_uid = ?", p.UID).Delete(&MentionRow{}); err != nil {
			return err
		}
		return s.insertMentions(sess, p, mentions)
	})
}

// softDelete marks a pulse as deleted and bumps the thread version so live
// subscribers refetch.
//
// Implementation note: xorm's struct-based Update treats `bool false` as a
// zero value and silently elides it from the UPDATE column list when going
// the other direction (true→false). To keep this predictable in both
// directions we use raw SQL here, which also avoids xorm's "updated"
// column auto-fill that can clash with our explicit Updated set.
func (s *store) softDelete(ctx context.Context, orgID int64, uid string) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var p Pulse
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&p)
		if err != nil {
			return err
		}
		if !ok {
			return ErrPulseNotFound
		}
		if p.Deleted {
			return ErrPulseAlreadyDeleted
		}
		now := time.Now().UTC()
		if _, err := sess.Exec("UPDATE pulse SET deleted = ?, updated = ? WHERE org_id = ? AND uid = ?",
			true, now, orgID, uid); err != nil {
			return err
		}
		// Keep the in-memory thread reference fresh for the rest of the tx.
		p.Deleted = true
		p.Updated = now
		// bump thread version so subscribers refetch. Loading and updating
		// via xorm lets the auto-version trigger on the row instead of us
		// hand-rolling SQL that would skip the magic.
		var thread Thread
		ok2, err := sess.Where("org_id = ? AND uid = ?", orgID, p.ThreadUID).Get(&thread)
		if err != nil || !ok2 {
			return err
		}
		thread.Updated = time.Now().UTC()
		_, err = sess.ID(thread.ID).Cols("updated").Update(&thread)
		return err
	})
}

// upsertSubscription is idempotent — calling it twice for the same user is
// a no-op rather than an error.
func (s *store) upsertSubscription(ctx context.Context, sub Subscription) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var existing Subscription
		ok, err := sess.Where("org_id = ? AND thread_uid = ? AND user_id = ?", sub.OrgID, sub.ThreadUID, sub.UserID).Get(&existing)
		if err != nil {
			return err
		}
		if ok {
			return nil
		}
		_, err = sess.Insert(&sub)
		return err
	})
}

func (s *store) deleteSubscription(ctx context.Context, sub Subscription) error {
	return s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Where("org_id = ? AND thread_uid = ? AND user_id = ?", sub.OrgID, sub.ThreadUID, sub.UserID).Delete(&Subscription{})
		return err
	})
}

// listSubscribers returns user_ids subscribed to a thread (used for fanout).
func (s *store) listSubscribers(ctx context.Context, orgID int64, threadUID string) ([]int64, error) {
	subs := make([]Subscription, 0)
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("org_id = ? AND thread_uid = ?", orgID, threadUID).Find(&subs)
	})
	if err != nil {
		return nil, err
	}
	out := make([]int64, 0, len(subs))
	now := time.Now()
	for _, s := range subs {
		if s.MuteUntil != nil && s.MuteUntil.After(now) {
			continue
		}
		out = append(out, s.UserID)
	}
	return out, nil
}

// upsertReadState writes the user's last-read marker on a thread.
func (s *store) upsertReadState(ctx context.Context, rs ReadState) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var existing ReadState
		ok, err := sess.Where("org_id = ? AND thread_uid = ? AND user_id = ?", rs.OrgID, rs.ThreadUID, rs.UserID).Get(&existing)
		if err != nil {
			return err
		}
		if !ok {
			_, err := sess.Insert(&rs)
			return err
		}
		existing.LastReadPulseUID = rs.LastReadPulseUID
		existing.LastReadAt = rs.LastReadAt
		_, err = sess.Where("org_id = ? AND thread_uid = ? AND user_id = ?", rs.OrgID, rs.ThreadUID, rs.UserID).Cols("last_read_pulse_uid", "last_read_at").Update(&existing)
		return err
	})
}

// resourceVersion sums the versions of all threads on a resource. Cheap
// O(threads-on-resource) read used by the polling fallback. We could
// denormalize this onto a separate table later if hot.
func (s *store) resourceVersion(ctx context.Context, orgID int64, kind ResourceKind, uid string) (ResourceVersion, error) {
	var rows []Thread
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("org_id = ? AND resource_kind = ? AND resource_uid = ?", orgID, kind, uid).
			Cols("version", "last_pulse_at").
			Find(&rows)
	})
	if err != nil {
		return ResourceVersion{}, err
	}
	rv := ResourceVersion{ResourceKind: kind, ResourceUID: uid}
	for _, r := range rows {
		rv.Version += r.Version
		if r.LastPulseAt.After(rv.LastPulseAt) {
			rv.LastPulseAt = r.LastPulseAt
		}
	}
	return rv, nil
}

// ensureThreadResource normalizes a resource_uid value (trim whitespace,
// reject empties). Returning a typed error keeps the API handler simple.
func ensureThreadResource(kind ResourceKind, uid string) error {
	if !kind.Valid() {
		return ErrInvalidResourceKind
	}
	if strings.TrimSpace(uid) == "" {
		return ErrThreadResourceMissing
	}
	return nil
}

// errMentionRowsExist is sentinel-like; not exported, only used to detect
// unique-violation cases on retry. Keep close to the store to avoid
// leaking xorm error types upward.
var errMentionRowsExist = errors.New("mention rows already exist")

package pulse

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/xorm"
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
//
// The author is also marked as having read this initial pulse before the
// transaction commits, so the per-resource unread-count badge does not
// immediately light up for the person who just wrote the message.
func (s *store) insertThreadAndPulse(ctx context.Context, t Thread, p Pulse, mentions []Mention) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		if _, err := sess.Insert(&p); err != nil {
			return err
		}
		if err := s.insertMentions(sess, p, mentions); err != nil {
			return err
		}
		return upsertReadStateInSession(sess, ReadState{
			OrgID: p.OrgID, ThreadUID: t.UID, UserID: p.AuthorUserID,
			LastReadPulseUID: p.UID, LastReadAt: p.Created,
		})
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
		if err := s.insertMentions(sess, p, mentions); err != nil {
			return err
		}
		// Posting a reply means the author has seen everything up to
		// and including their own pulse — keep the unread badge from
		// firing on their own message by advancing their read marker
		// inside the same transaction.
		return upsertReadStateInSession(sess, ReadState{
			OrgID: p.OrgID, ThreadUID: thread.UID, UserID: p.AuthorUserID,
			LastReadPulseUID: p.UID, LastReadAt: p.Created,
		})
	})
	return thread, err
}

func (s *store) insertMentions(sess *db.Session, p Pulse, mentions []Mention) error {
	if len(mentions) == 0 {
		return nil
	}
	rows := make([]MentionRow, 0, len(mentions))
	for _, m := range mentions {
		// Time chips carry a `<fromMs>|<toMs>` range, not an entity id —
		// nothing looks them up in the denormalized table (no user / panel /
		// dashboard target to match), so persisting them is just write
		// amplification and would dirty the (kind, target_id) index with
		// values that don't match its lookup shape.
		if m.Kind == MentionKindTime {
			continue
		}
		rows = append(rows, MentionRow{
			PulseUID:  p.UID,
			ThreadUID: p.ThreadUID,
			OrgID:     p.OrgID,
			Kind:      m.Kind,
			TargetID:  m.TargetID,
			Created:   p.Created,
		})
	}
	if len(rows) == 0 {
		return nil
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
//
// All three filters share one rule: a match on any non-deleted child
// pulse lifts its parent thread into the result, so the drawer
// behaves the way users mentally model a "thread" (root + replies as
// one unit) instead of forcing them to expand each thread to find
// the pulse that actually matches.
//
//   - PanelID: (anchored to panel) OR (any pulse on the thread carries
//     a `#panel:N` chip). The mention fan-out is denormalized into
//     pulse_mention with thread_uid per row, so the sub-select picks
//     up replies for free without a JOIN to pulse.
//   - AuthorUserID: (created_by) OR (the user authored any non-deleted
//     pulse on the thread). Same shape as listAllThreads's "Mine"
//     filter, scoped to one resource. Hits the (org_id,
//     author_user_id) prefix on pulse so cost stays cheap on chatty
//     dashboards.
//   - Query: case-insensitive substring match against either the
//     thread title or the body_text of any non-deleted pulse on the
//     thread. Identical structure to listAllThreads's search clause —
//     LOWER(...) keeps behavior stable across SQLite, MySQL and
//     Postgres without depending on collation defaults.
func (s *store) listThreads(ctx context.Context, q ListThreadsQuery) (PageResult[Thread], error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 50
	}
	if q.Page <= 0 {
		q.Page = 1
	}

	threads := make([]Thread, 0, q.Limit)
	var total int64
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// xorm consumes filter conditions on Run, so we rebuild the
		// session via this helper to apply the same WHERE clause to
		// both the Count and the Find. Mirrors listAllThreads.
		applyFilters := func() *xorm.Session {
			sb := sess.Where("org_id = ? AND resource_kind = ? AND resource_uid = ?", q.OrgID, q.ResourceKind, q.ResourceUID)
			if q.PanelID != nil {
				sb = sb.And(
					"(panel_id = ? OR uid IN (SELECT thread_uid FROM pulse_mention WHERE org_id = ? AND kind = ? AND target_id = ?))",
					*q.PanelID, q.OrgID, MentionKindPanel, strconv.FormatInt(*q.PanelID, 10),
				)
			}
			if q.AuthorUserID != nil {
				sb = sb.And(
					"(created_by = ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND deleted = ? AND author_user_id = ?))",
					*q.AuthorUserID, q.OrgID, false, *q.AuthorUserID,
				)
			}
			if needle := strings.TrimSpace(q.Query); needle != "" {
				like := "%" + strings.ToLower(needle) + "%"
				sb = sb.And(
					"(LOWER(title) LIKE ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND deleted = ? AND LOWER(body_text) LIKE ?))",
					like, q.OrgID, false, like,
				)
			}
			// "Mine" expands to (created_by=? OR authored any pulse OR
			// subscribed). Each half is a sub-select on its own indexed
			// (org_id, user_id) prefix, mirroring listAllThreads so the
			// per-resource list inherits the same definition of "Mine"
			// — a user who only subscribed (without posting) still sees
			// the thread, which matches the global overview.
			if q.MineOnly && q.UserID > 0 {
				sb = sb.And(
					"(created_by = ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND author_user_id = ?) OR uid IN (SELECT thread_uid FROM pulse_subscription WHERE org_id = ? AND user_id = ?))",
					q.UserID, q.OrgID, q.UserID, q.OrgID, q.UserID,
				)
			}
			// Status filter: `closed` is a plain bool column, so the
			// comparison is direct. The zero value (ThreadStatusAny)
			// is intentionally a no-op so an absent query param never
			// accidentally clamps the result set.
			switch q.Status {
			case ThreadStatusOpen:
				sb = sb.And("closed = ?", false)
			case ThreadStatusClosed:
				sb = sb.And("closed = ?", true)
			case ThreadStatusAny:
				// no-op: no closed-state filter applied.
			}
			return sb
		}

		n, err := applyFilters().Count(&Thread{})
		if err != nil {
			return err
		}
		total = n

		offset := (q.Page - 1) * q.Limit
		// Tie-break on uid (deterministic) so two threads sharing a
		// last_pulse_at don't shuffle between pages on different
		// cursor positions — same pattern as before, but now the
		// pager is offset-driven rather than cursor-driven.
		return applyFilters().
			OrderBy("last_pulse_at DESC, uid DESC").
			Limit(q.Limit, offset).
			Find(&threads)
	})
	if err != nil {
		return PageResult[Thread]{}, err
	}

	return PageResult[Thread]{
		Items:      threads,
		Page:       q.Page,
		TotalCount: total,
		HasMore:    int64(q.Page*q.Limit) < total,
	}, nil
}

// listAllThreads returns the most-recently-active threads across every
// resource in an org. Powers the global Pulse overview page; callers with
// MineOnly=true narrow to threads the user participates in.
//
// Authorization is intentionally NOT enforced at this layer — the caller
// has the org_id and a Pulse RBAC action gate at the route. Per-thread
// dashboard read permission is filtered in the API layer because the
// dashboard guardian wants a *contextmodel.ReqContext we don't have here.
//
// SQL shape:
//   - Search collapses to (title LIKE %q% OR thread has any non-deleted
//     pulse whose body_text LIKE %q%). Both halves are case-insensitive
//     via LOWER(...) so behavior is identical on SQLite, MySQL and
//     Postgres without relying on collation defaults.
//   - "Mine" expands to (created_by=? OR I authored any pulse OR I am
//     subscribed). Each half is a subquery on its own indexed
//     (org_id, user_id) prefix, so the planner can use the right index
//     for each branch.
func (s *store) listAllThreads(ctx context.Context, q ListAllThreadsQuery) (PageResult[Thread], error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 25
	}
	if q.Page <= 0 {
		q.Page = 1
	}

	threads := make([]Thread, 0, q.Limit)
	var total int64
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Apply the filter conditions to a fresh xorm session. We can't
		// reuse the same builder for both Count and Find because xorm
		// consumes the conditions on Run, so we rebuild via this helper.
		applyFilters := func() *xorm.Session {
			sb := sess.Where("org_id = ?", q.OrgID)
			if needle := strings.TrimSpace(q.Query); needle != "" {
				like := "%" + strings.ToLower(needle) + "%"
				sb = sb.And(
					"(LOWER(title) LIKE ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND deleted = ? AND LOWER(body_text) LIKE ?))",
					like, q.OrgID, false, like,
				)
			}
			if q.MineOnly && q.UserID > 0 {
				sb = sb.And(
					"(created_by = ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND author_user_id = ?) OR uid IN (SELECT thread_uid FROM pulse_subscription WHERE org_id = ? AND user_id = ?))",
					q.UserID, q.OrgID, q.UserID, q.OrgID, q.UserID,
				)
			}
			// Status filter: closed is a plain bool column, so the
			// comparison is direct. We accept the zero value as
			// "any" (no condition added) so an absent query string
			// never accidentally clamps the result set.
			switch q.Status {
			case ThreadStatusOpen:
				sb = sb.And("closed = ?", false)
			case ThreadStatusClosed:
				sb = sb.And("closed = ?", true)
			case ThreadStatusAny:
				// no-op: no closed-state filter applied.
			}
			return sb
		}

		n, err := applyFilters().Count(&Thread{})
		if err != nil {
			return err
		}
		total = n

		offset := (q.Page - 1) * q.Limit
		return applyFilters().
			OrderBy("last_pulse_at DESC, id DESC").
			Limit(q.Limit, offset).
			Find(&threads)
	})
	if err != nil {
		return PageResult[Thread]{}, err
	}

	res := PageResult[Thread]{
		Items:      threads,
		Page:       q.Page,
		TotalCount: total,
		HasMore:    int64(q.Page*q.Limit) < total,
	}
	return res, nil
}

// listFolderRolledUpThreads returns the most-recently-active
// dashboard-scoped threads whose dashboard UID is in the supplied
// allowlist. Powers the folder Pulse tab: the service layer resolves
// the folder hierarchy → dashboard UIDs → permission-filtered set,
// and this query rolls those threads into a single sorted page.
//
// Filter semantics mirror listThreads / listAllThreads exactly so
// the folder tab can offer the same Status / Mine / search / Users
// dropdown as every other Pulse surface; the only structural change
// is the WHERE switches from a single resource_uid match to an IN
// over the resolved dashboard UID set.
//
// An empty DashboardUIDs slice short-circuits to an empty page
// rather than executing a degenerate "WHERE resource_uid IN ()"
// query — the dialects handle empty IN clauses inconsistently and
// we never want to surface threads from outside the resolved set
// even by accident.
func (s *store) listFolderRolledUpThreads(ctx context.Context, q ListFolderRolledUpThreadsQuery) (PageResult[Thread], error) {
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 25
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	if len(q.DashboardUIDs) == 0 {
		return PageResult[Thread]{Items: []Thread{}, Page: q.Page, TotalCount: 0, HasMore: false}, nil
	}

	threads := make([]Thread, 0, q.Limit)
	var total int64
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		applyFilters := func() *xorm.Session {
			sb := sess.
				Where("org_id = ? AND resource_kind = ?", q.OrgID, ResourceKindDashboard).
				In("resource_uid", q.DashboardUIDs)
			if q.AuthorUserID != nil {
				sb = sb.And(
					"(created_by = ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND deleted = ? AND author_user_id = ?))",
					*q.AuthorUserID, q.OrgID, false, *q.AuthorUserID,
				)
			}
			if needle := strings.TrimSpace(q.Query); needle != "" {
				like := "%" + strings.ToLower(needle) + "%"
				sb = sb.And(
					"(LOWER(title) LIKE ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND deleted = ? AND LOWER(body_text) LIKE ?))",
					like, q.OrgID, false, like,
				)
			}
			if q.MineOnly && q.UserID > 0 {
				sb = sb.And(
					"(created_by = ? OR uid IN (SELECT thread_uid FROM pulse WHERE org_id = ? AND author_user_id = ?) OR uid IN (SELECT thread_uid FROM pulse_subscription WHERE org_id = ? AND user_id = ?))",
					q.UserID, q.OrgID, q.UserID, q.OrgID, q.UserID,
				)
			}
			switch q.Status {
			case ThreadStatusOpen:
				sb = sb.And("closed = ?", false)
			case ThreadStatusClosed:
				sb = sb.And("closed = ?", true)
			case ThreadStatusAny:
				// no-op: any status is allowed.
			}
			return sb
		}

		n, err := applyFilters().Count(&Thread{})
		if err != nil {
			return err
		}
		total = n

		offset := (q.Page - 1) * q.Limit
		return applyFilters().
			OrderBy("last_pulse_at DESC, uid DESC").
			Limit(q.Limit, offset).
			Find(&threads)
	})
	if err != nil {
		return PageResult[Thread]{}, err
	}

	return PageResult[Thread]{
		Items:      threads,
		Page:       q.Page,
		TotalCount: total,
		HasMore:    int64(q.Page*q.Limit) < total,
	}, nil
}

// firstPulseBodiesByThread returns the body_json of the earliest
// non-deleted pulse for each given thread. We hand back the AST (not the
// pre-rendered body_text) so the frontend can render the same mention
// chips + formatting it would inside the thread itself; that also lets
// us reflow legacy rows whose stored body_text was generated before
// later formatting fixes (panel `#` prefix, post-mention spacing).
func (s *store) firstPulseBodiesByThread(ctx context.Context, orgID int64, threadUIDs []string) (map[string]json.RawMessage, error) {
	if len(threadUIDs) == 0 {
		return nil, nil
	}
	rows := make([]Pulse, 0, len(threadUIDs))
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.
			Where("org_id = ?", orgID).
			In("thread_uid", threadUIDs).
			And("deleted = ?", false).
			Cols("thread_uid", "body_json", "created").
			OrderBy("thread_uid ASC, created ASC, id ASC").
			Find(&rows)
	})
	if err != nil {
		return nil, err
	}
	out := make(map[string]json.RawMessage, len(rows))
	for _, r := range rows {
		if _, ok := out[r.ThreadUID]; ok {
			continue
		}
		out[r.ThreadUID] = r.BodyJSON
	}
	return out, nil
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

// listPanelMentions rolls up open threads that touch each panel on a
// resource. A thread "touches" a panel when it is anchored to that
// panel (Thread.PanelID) or when any of its pulses contain a #panel
// mention chip pointing at it. Both conditions are folded into a
// single per-panel summary so the title-bar indicator lights up for
// either signal without forcing the frontend to make two calls.
//
// Implementation note: we issue two small queries and merge in Go
// rather than UNION + GROUP BY in SQL. The cross-database type
// coercion (pulse_thread.panel_id is INT, pulse_mention.target_id is
// VARCHAR) and the "latest thread title" projection both get gnarlier
// to express portably than the merge cost saves. Both queries hit
// existing indexes (pulse_thread (org_id, resource_kind, resource_uid)
// and pulse_mention (org_id, kind, target_id)) and a typical dashboard
// has tens of panels and hundreds of threads at most, so the merge
// runs over at most a few hundred rows.
func (s *store) listPanelMentions(ctx context.Context, q ListPanelMentionsQuery) ([]PanelMentionSummary, error) {
	type row struct {
		PanelID     int64
		ThreadUID   string
		LastPulseAt time.Time
		Title       string
	}

	rows := make([]row, 0)

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Anchored threads: thread.panel_id directly identifies the panel.
		anchored := make([]Thread, 0)
		if err := sess.Table(&Thread{}).
			Where("org_id = ? AND resource_kind = ? AND resource_uid = ? AND panel_id IS NOT NULL AND closed = ?",
				q.OrgID, q.ResourceKind, q.ResourceUID, false).
			Cols("uid", "panel_id", "title", "last_pulse_at").
			Find(&anchored); err != nil {
			return err
		}
		for _, t := range anchored {
			if t.PanelID == nil {
				continue
			}
			rows = append(rows, row{
				PanelID:     *t.PanelID,
				ThreadUID:   t.UID,
				LastPulseAt: t.LastPulseAt,
				Title:       t.Title,
			})
		}

		// Mentioned threads: join via the denormalized pulse_mention
		// table. Mentions on the same thread collapse to one row per
		// (panel, thread) pair via DISTINCT — a single thread can mention
		// the same panel from many pulses.
		type mentionRow struct {
			TargetID    string    `xorm:"target_id"`
			ThreadUID   string    `xorm:"thread_uid"`
			LastPulseAt time.Time `xorm:"last_pulse_at"`
			Title       string    `xorm:"title"`
		}
		mentioned := make([]mentionRow, 0)
		if err := sess.SQL(`
			SELECT DISTINCT m.target_id, t.uid AS thread_uid, t.last_pulse_at, t.title
			FROM pulse_mention m
			JOIN pulse_thread t ON m.thread_uid = t.uid AND m.org_id = t.org_id
			WHERE m.org_id = ? AND m.kind = ?
			  AND t.resource_kind = ? AND t.resource_uid = ? AND t.closed = ?`,
			q.OrgID, MentionKindPanel,
			q.ResourceKind, q.ResourceUID, false,
		).Find(&mentioned); err != nil {
			return err
		}
		for _, m := range mentioned {
			// Mention.TargetID is a string column because user mentions
			// also live in this table. For panel mentions the composer
			// always writes a numeric id, but defensive parsing here
			// keeps a malformed target_id (manual API caller, future
			// schema change, etc.) from blowing up the whole rollup.
			pid, parseErr := strconv.ParseInt(strings.TrimSpace(m.TargetID), 10, 64)
			if parseErr != nil {
				continue
			}
			rows = append(rows, row{
				PanelID:     pid,
				ThreadUID:   m.ThreadUID,
				LastPulseAt: m.LastPulseAt,
				Title:       m.Title,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Merge: per panel, dedupe threads (a thread may be anchored AND
	// mentioned), pick the most-recently-active one as the click
	// target, and sum the distinct count. Map iteration order is
	// non-deterministic in Go, so we sort the final slice by panel id
	// to keep the wire payload stable across calls.
	type bucket struct {
		threads     map[string]struct{}
		latestUID   string
		latestAt    time.Time
		latestTitle string
	}
	byPanel := make(map[int64]*bucket)
	for _, r := range rows {
		b, ok := byPanel[r.PanelID]
		if !ok {
			b = &bucket{threads: make(map[string]struct{})}
			byPanel[r.PanelID] = b
		}
		if _, seen := b.threads[r.ThreadUID]; seen {
			// Don't downgrade latestAt if we re-encounter the same thread
			// via the other code path; the timestamps come from the same
			// pulse_thread row so they match anyway.
			continue
		}
		b.threads[r.ThreadUID] = struct{}{}
		if r.LastPulseAt.After(b.latestAt) || b.latestUID == "" {
			b.latestAt = r.LastPulseAt
			b.latestUID = r.ThreadUID
			b.latestTitle = r.Title
		}
	}

	out := make([]PanelMentionSummary, 0, len(byPanel))
	for pid, b := range byPanel {
		out = append(out, PanelMentionSummary{
			PanelID:           pid,
			ThreadCount:       len(b.threads),
			LatestThreadUID:   b.latestUID,
			LatestThreadTitle: b.latestTitle,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].PanelID < out[j].PanelID })
	return out, nil
}

// listParticipantUserIDs returns the unique non-zero user ids that have
// either started a thread or posted a non-deleted pulse on the resource.
// Closed threads are intentionally counted: a user who replied on a now-
// closed thread should still appear in the participants filter so they
// can find their own contribution. The service layer hydrates these ids
// into ParticipantSummary rows via userSvc.ListByIdOrUID.
//
// We issue two queries and merge in Go to keep the SQL portable across
// SQLite, MySQL and Postgres — UNION-ing into a derived table works on
// all three but xorm's session API doesn't expose a clean way to select
// from a subquery, and the merge cost is bounded by the number of
// participants on a single dashboard (tens at most).
func (s *store) listParticipantUserIDs(ctx context.Context, q ListParticipantsQuery) ([]int64, error) {
	seen := make(map[int64]struct{})
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		// Thread starters: created_by from each thread on the resource.
		type starter struct {
			CreatedBy int64 `xorm:"created_by"`
		}
		starters := make([]starter, 0)
		if err := sess.Table(&Thread{}).
			Where("org_id = ? AND resource_kind = ? AND resource_uid = ?", q.OrgID, q.ResourceKind, q.ResourceUID).
			Cols("created_by").Find(&starters); err != nil {
			return err
		}
		for _, s := range starters {
			if s.CreatedBy > 0 {
				seen[s.CreatedBy] = struct{}{}
			}
		}

		// Repliers: non-deleted pulse rows whose thread is on this
		// resource. The join key (thread_uid, org_id) is covered by the
		// pulse_thread unique index so the planner stays cheap.
		type replier struct {
			AuthorUserID int64 `xorm:"author_user_id"`
		}
		repliers := make([]replier, 0)
		if err := sess.SQL(`
			SELECT DISTINCT p.author_user_id
			FROM pulse p
			JOIN pulse_thread t ON p.thread_uid = t.uid AND p.org_id = t.org_id
			WHERE t.org_id = ? AND t.resource_kind = ? AND t.resource_uid = ?
			  AND p.deleted = ? AND p.author_user_id > 0`,
			q.OrgID, q.ResourceKind, q.ResourceUID, false,
		).Find(&repliers); err != nil {
			return err
		}
		for _, r := range repliers {
			seen[r.AuthorUserID] = struct{}{}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids, nil
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

// deleteThread hard-deletes a thread plus its pulses, mention rows,
// subscriptions, and read-state rows. We deliberately do not soft-delete
// here: a thread author or admin pulling the plug expects the data gone.
// Individual pulses inside still have soft-delete (the tombstone UI), but
// removing the parent removes everything.
func (s *store) deleteThread(ctx context.Context, orgID int64, uid string) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var t Thread
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&t)
		if err != nil {
			return err
		}
		if !ok {
			return ErrThreadNotFound
		}
		if _, err := sess.Exec("DELETE FROM pulse_mention WHERE org_id = ? AND thread_uid = ?", orgID, uid); err != nil {
			return err
		}
		if _, err := sess.Exec("DELETE FROM pulse WHERE org_id = ? AND thread_uid = ?", orgID, uid); err != nil {
			return err
		}
		if _, err := sess.Exec("DELETE FROM pulse_subscription WHERE org_id = ? AND thread_uid = ?", orgID, uid); err != nil {
			return err
		}
		if _, err := sess.Exec("DELETE FROM pulse_read_state WHERE org_id = ? AND thread_uid = ?", orgID, uid); err != nil {
			return err
		}
		if _, err := sess.Exec("DELETE FROM pulse_thread WHERE org_id = ? AND uid = ?", orgID, uid); err != nil {
			return err
		}
		return nil
	})
}

// setThreadClosed flips the closed flag and bumps the thread version. We
// use raw SQL for the same reason as softDelete: xorm's struct-Update
// elides false bools, which would prevent reopen from working.
func (s *store) setThreadClosed(ctx context.Context, orgID int64, uid string, closed bool, by int64) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var t Thread
		ok, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&t)
		if err != nil {
			return err
		}
		if !ok {
			return ErrThreadNotFound
		}
		if closed && t.Closed {
			return ErrThreadAlreadyClosed
		}
		if !closed && !t.Closed {
			return ErrThreadNotClosed
		}
		now := time.Now().UTC()
		if closed {
			if _, err := sess.Exec(
				"UPDATE pulse_thread SET closed = ?, closed_at = ?, closed_by = ?, updated = ? WHERE org_id = ? AND uid = ?",
				true, now, by, now, orgID, uid,
			); err != nil {
				return err
			}
		} else {
			if _, err := sess.Exec(
				"UPDATE pulse_thread SET closed = ?, closed_at = NULL, closed_by = NULL, updated = ? WHERE org_id = ? AND uid = ?",
				false, now, orgID, uid,
			); err != nil {
				return err
			}
		}
		// Bump version via a no-op Update so xorm's auto-version column
		// trigger fires; subscribers will refetch.
		t.Updated = now
		if _, err := sess.ID(t.ID).Cols("updated").Update(&t); err != nil {
			return err
		}
		return nil
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

// isSubscribed reports whether a specific user has an active (non-muted)
// subscription to a thread. Used to populate Thread.IsSubscribed on the
// single-thread read so the UI can render the subscribe/unsubscribe
// toggle in the right state.
func (s *store) isSubscribed(ctx context.Context, orgID int64, threadUID string, userID int64) (bool, error) {
	var sub Subscription
	var found bool
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		ok, err := sess.Where("org_id = ? AND thread_uid = ? AND user_id = ?", orgID, threadUID, userID).Get(&sub)
		if err != nil {
			return err
		}
		// A muted subscription still counts as "subscribed" for the
		// toggle's purposes: the user opted in, mute is a separate axis
		// we don't surface in v1.
		found = ok
		return nil
	})
	if err != nil {
		return false, err
	}
	return found, nil
}

// upsertReadState writes the user's last-read marker on a thread.
func (s *store) upsertReadState(ctx context.Context, rs ReadState) error {
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		return upsertReadStateInSession(sess, rs)
	})
}

// upsertReadStateInSession is the inner half of upsertReadState, broken
// out so write paths that already hold a transactional session (thread
// + pulse creation) can advance the author's read marker atomically
// with the write. Two callers, identical idempotent semantics.
func upsertReadStateInSession(sess *db.Session, rs ReadState) error {
	if rs.UserID == 0 || rs.ThreadUID == "" {
		// Defensive: anonymous / service authors carry no user id, so
		// there's nothing to mark read for. Skipping here keeps the
		// pulse_read_state table free of zero-id rows that the count
		// query would otherwise have to filter out at read time.
		return nil
	}
	if rs.LastReadAt.IsZero() {
		rs.LastReadAt = time.Now().UTC()
	}
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
}

// countUnreadThreadsForResource returns the number of threads on a
// single resource that the caller has unread activity on. "Unread" is
// the union of (no read-state row for the user on that thread) and
// (the thread's last_pulse_at is newer than the user's last_read_at
// on that thread). Threads with a zero pulse_count are excluded so
// hard-deletion races never inflate the badge.
//
// Authorisation is the caller's job at the API layer; the store query
// is org-scoped only. Implementation note: we issue raw SQL with a
// LEFT JOIN rather than two separate queries because the alternative
// (load every thread + load every read-state row + join in Go) scales
// poorly on chatty dashboards and the badge is rendered on every
// dashboard view. The LEFT JOIN keeps the work inside the database
// where it's cheapest.
func (s *store) countUnreadThreadsForResource(ctx context.Context, orgID, userID int64, kind ResourceKind, uid string) (int64, error) {
	if userID == 0 {
		// Anonymous viewers don't have a per-user read marker, so
		// "unread" is undefined for them. Returning zero avoids
		// flashing a badge over the icon for someone who has no
		// way to clear it.
		return 0, nil
	}
	var count int64
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.SQL(`
			SELECT COUNT(*) FROM pulse_thread t
			LEFT JOIN pulse_read_state rs
				ON rs.org_id = t.org_id
				AND rs.thread_uid = t.uid
				AND rs.user_id = ?
			WHERE t.org_id = ?
				AND t.resource_kind = ?
				AND t.resource_uid = ?
				AND t.pulse_count > 0
				AND (rs.last_read_at IS NULL OR rs.last_read_at < t.last_pulse_at)
		`, userID, orgID, string(kind), uid).Get(&count)
		return err
	})
	if err != nil {
		return 0, err
	}
	return count, nil
}

// countUnreadThreadsForDashboards returns the unread thread count
// across an allowlist of dashboard UIDs. Powers the folder Pulse tab
// counter: the service layer resolves the folder hierarchy to a set
// of accessible dashboards, hands the UIDs in here, and this query
// rolls them into a single number.
//
// An empty allowlist short-circuits to zero rather than executing a
// degenerate "WHERE resource_uid IN ()" query — dialect handling of
// empty IN clauses is inconsistent, and we never want the folder
// count to leak threads from outside the resolved set even by
// accident.
func (s *store) countUnreadThreadsForDashboards(ctx context.Context, orgID, userID int64, dashboardUIDs []string) (int64, error) {
	if userID == 0 || len(dashboardUIDs) == 0 {
		return 0, nil
	}
	var count int64
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		args := make([]any, 0, 3+len(dashboardUIDs))
		args = append(args, userID, orgID, string(ResourceKindDashboard))
		placeholders := make([]string, len(dashboardUIDs))
		for i, uid := range dashboardUIDs {
			placeholders[i] = "?"
			args = append(args, uid)
		}
		query := `
			SELECT COUNT(*) FROM pulse_thread t
			LEFT JOIN pulse_read_state rs
				ON rs.org_id = t.org_id
				AND rs.thread_uid = t.uid
				AND rs.user_id = ?
			WHERE t.org_id = ?
				AND t.resource_kind = ?
				AND t.resource_uid IN (` + strings.Join(placeholders, ",") + `)
				AND t.pulse_count > 0
				AND (rs.last_read_at IS NULL OR rs.last_read_at < t.last_pulse_at)
		`
		_, err := sess.SQL(query, args...).Get(&count)
		return err
	})
	if err != nil {
		return 0, err
	}
	return count, nil
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

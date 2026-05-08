package pulse

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func sampleBody(t *testing.T, text string) (json.RawMessage, *ParsedBody) {
	t.Helper()
	raw := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"` + text + `"}]}]}}`)
	pb, err := ParseAndValidateBody(raw)
	require.NoError(t, err)
	return raw, pb
}

func TestIntegrationPulseStore_ThreadAndPulseLifecycle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)

	now := time.Now().UTC()
	threadUID := util.GenerateShortUID()
	pulseUID := util.GenerateShortUID()
	body, parsed := sampleBody(t, "hello dashboard")

	thread := Thread{
		UID:          threadUID,
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-1",
		CreatedBy:    1,
		Created:      now,
		Updated:      now,
		LastPulseAt:  now,
		PulseCount:   1,
		Version:      1,
	}
	pulse := Pulse{
		UID:          pulseUID,
		ThreadUID:    threadUID,
		OrgID:        1,
		AuthorUserID: 1,
		AuthorKind:   AuthorKindUser,
		BodyText:     parsed.Text,
		BodyJSON:     body,
		Created:      now,
		Updated:      now,
	}

	err := st.insertThreadAndPulse(ctx, thread, pulse, parsed.Mentions)
	require.NoError(t, err)

	// fetch back
	got, err := st.getThreadByUID(ctx, 1, threadUID)
	require.NoError(t, err)
	require.Equal(t, threadUID, got.UID)
	require.EqualValues(t, 1, got.PulseCount)

	// list threads on resource
	page, err := st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: "dash-1",
	})
	require.NoError(t, err)
	require.Len(t, page.Items, 1)

	// add a reply, ensure thread counters bump
	reply := Pulse{
		UID:          util.GenerateShortUID(),
		ThreadUID:    threadUID,
		ParentUID:    pulseUID,
		OrgID:        1,
		AuthorUserID: 2,
		AuthorKind:   AuthorKindUser,
		BodyText:     "hi back",
		BodyJSON:     json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hi back"}]}]}}`),
		Created:      now.Add(time.Second),
		Updated:      now.Add(time.Second),
	}
	updatedThread, err := st.insertPulse(ctx, reply, nil)
	require.NoError(t, err)
	require.EqualValues(t, 2, updatedThread.PulseCount)
	require.EqualValues(t, 2, updatedThread.Version)

	// list pulses returns oldest first
	pageP, err := st.listPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: threadUID})
	require.NoError(t, err)
	require.Len(t, pageP.Items, 2)
	require.Equal(t, pulseUID, pageP.Items[0].UID)
	require.Equal(t, reply.UID, pageP.Items[1].UID)

	// soft delete the parent
	err = st.softDelete(ctx, 1, pulseUID)
	require.NoError(t, err)

	// sanity: store reflects deleted=true
	gotParent, err := st.getPulseByUID(ctx, 1, pulseUID)
	require.NoError(t, err)
	require.True(t, gotParent.Deleted, "parent should be soft-deleted")

	// reply to a deleted parent fails
	bad := reply
	bad.UID = util.GenerateShortUID()
	bad.ParentUID = pulseUID
	_, err = st.insertPulse(ctx, bad, nil)
	require.ErrorIs(t, err, ErrParentPulseDeleted)

	// resource version sums the bumps
	rv, err := st.resourceVersion(ctx, 1, ResourceKindDashboard, "dash-1")
	require.NoError(t, err)
	require.GreaterOrEqual(t, rv.Version, int64(2))
}

func TestIntegrationPulseStore_SubscriptionAndReadState(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)

	threadUID := util.GenerateShortUID()
	now := time.Now().UTC()

	// idempotent subscribe
	sub := Subscription{OrgID: 1, ThreadUID: threadUID, UserID: 7, SubscribedAt: now}
	require.NoError(t, st.upsertSubscription(ctx, sub))
	require.NoError(t, st.upsertSubscription(ctx, sub)) // second time is a no-op

	users, err := st.listSubscribers(ctx, 1, threadUID)
	require.NoError(t, err)
	require.Equal(t, []int64{7}, users)

	// read state upsert
	rs := ReadState{OrgID: 1, ThreadUID: threadUID, UserID: 7, LastReadPulseUID: "p1", LastReadAt: now}
	require.NoError(t, st.upsertReadState(ctx, rs))
	rs.LastReadPulseUID = "p2"
	rs.LastReadAt = now.Add(time.Minute)
	require.NoError(t, st.upsertReadState(ctx, rs))

	// unsubscribe
	require.NoError(t, st.deleteSubscription(ctx, sub))
	users, err = st.listSubscribers(ctx, 1, threadUID)
	require.NoError(t, err)
	require.Empty(t, users)
}

func TestIntegrationPulseStore_ListAllThreads(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)

	now := time.Now().UTC()

	// Three threads on three dashboards. user 1 starts threads A and B,
	// user 2 starts thread C. user 3 will reply to A. user 4 subscribes to C.
	makeThread := func(uid, dash, body string, by int64, created time.Time) {
		t.Helper()
		raw, parsed := sampleBody(t, body)
		err := st.insertThreadAndPulse(ctx,
			Thread{
				UID: uid, OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
				CreatedBy: by, Created: created, Updated: created, LastPulseAt: created,
				PulseCount: 1, Version: 1, Title: body,
			},
			Pulse{
				UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
				AuthorUserID: by, AuthorKind: AuthorKindUser,
				BodyText: parsed.Text, BodyJSON: raw, Created: created, Updated: created,
			},
			parsed.Mentions,
		)
		require.NoError(t, err)
	}
	makeThread("aaaaaaaaaaaaaa", "dash-A", "deploy is rolling out", 1, now.Add(-3*time.Minute))
	makeThread("bbbbbbbbbbbbbb", "dash-B", "p99 is spiking", 1, now.Add(-2*time.Minute))
	makeThread("cccccccccccccc", "dash-C", "fresh annotation here", 2, now.Add(-1*time.Minute))

	// user 3 replies on thread A
	_, err := st.insertPulse(ctx, Pulse{
		UID: util.GenerateShortUID(), ThreadUID: "aaaaaaaaaaaaaa", OrgID: 1,
		AuthorUserID: 3, AuthorKind: AuthorKindUser,
		BodyText: "rolling forward", BodyJSON: json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"rolling forward"}]}]}}`),
		Created: now, Updated: now,
	}, nil)
	require.NoError(t, err)

	// user 4 subscribes to thread C
	require.NoError(t, st.upsertSubscription(ctx, Subscription{
		OrgID: 1, ThreadUID: "cccccccccccccc", UserID: 4, SubscribedAt: now,
	}))

	t.Run("no filter returns every thread, newest first", func(t *testing.T) {
		page, err := st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1})
		require.NoError(t, err)
		require.Len(t, page.Items, 3)
		// thread A bumped its last_pulse_at via the reply, so it should
		// be first now.
		require.Equal(t, "aaaaaaaaaaaaaa", page.Items[0].UID)
	})

	t.Run("text search matches title and body", func(t *testing.T) {
		page, err := st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Query: "p99"})
		require.NoError(t, err)
		require.Len(t, page.Items, 1)
		require.Equal(t, "bbbbbbbbbbbbbb", page.Items[0].UID)

		// case-insensitive
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Query: "ANNOTATION"})
		require.NoError(t, err)
		require.Len(t, page.Items, 1)
		require.Equal(t, "cccccccccccccc", page.Items[0].UID)

		// match in a reply body, not the original
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Query: "rolling forward"})
		require.NoError(t, err)
		require.Len(t, page.Items, 1)
		require.Equal(t, "aaaaaaaaaaaaaa", page.Items[0].UID)
	})

	t.Run("mineOnly scopes to author/creator/subscriber", func(t *testing.T) {
		// user 1 created A and B
		page, err := st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, UserID: 1, MineOnly: true})
		require.NoError(t, err)
		uids := threadUIDs(page.Items)
		require.ElementsMatch(t, []string{"aaaaaaaaaaaaaa", "bbbbbbbbbbbbbb"}, uids)

		// user 3 only replied to A
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, UserID: 3, MineOnly: true})
		require.NoError(t, err)
		require.Equal(t, []string{"aaaaaaaaaaaaaa"}, threadUIDs(page.Items))

		// user 4 only subscribed to C
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, UserID: 4, MineOnly: true})
		require.NoError(t, err)
		require.Equal(t, []string{"cccccccccccccc"}, threadUIDs(page.Items))
	})

	t.Run("mineOnly + search compose", func(t *testing.T) {
		page, err := st.listAllThreads(ctx, ListAllThreadsQuery{
			OrgID: 1, UserID: 1, MineOnly: true, Query: "deploy",
		})
		require.NoError(t, err)
		require.Equal(t, []string{"aaaaaaaaaaaaaa"}, threadUIDs(page.Items))
	})

	t.Run("status filter narrows to open or closed threads", func(t *testing.T) {
		// Close thread B for the duration of this subtest. Reopen at
		// the end so subsequent subtests still see all three threads
		// open (preserves previous behaviour).
		require.NoError(t, st.setThreadClosed(ctx, 1, "bbbbbbbbbbbbbb", true, 1))
		t.Cleanup(func() {
			require.NoError(t, st.setThreadClosed(ctx, 1, "bbbbbbbbbbbbbb", false, 1))
		})

		// Default (any) returns every thread, regardless of state.
		page, err := st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1})
		require.NoError(t, err)
		require.Len(t, page.Items, 3)

		// Open hides the closed thread.
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Status: ThreadStatusOpen})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"aaaaaaaaaaaaaa", "cccccccccccccc"}, threadUIDs(page.Items))

		// Closed isolates the thread we just locked.
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Status: ThreadStatusClosed})
		require.NoError(t, err)
		require.Equal(t, []string{"bbbbbbbbbbbbbb"}, threadUIDs(page.Items))

		// Composes with mineOnly: user 1 owns A (open) and B (closed),
		// so "mine + open" should drop B but keep A.
		page, err = st.listAllThreads(ctx, ListAllThreadsQuery{
			OrgID: 1, UserID: 1, MineOnly: true, Status: ThreadStatusOpen,
		})
		require.NoError(t, err)
		require.Equal(t, []string{"aaaaaaaaaaaaaa"}, threadUIDs(page.Items))
	})

	t.Run("offset pagination splits results across pages", func(t *testing.T) {
		page1, err := st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Limit: 2, Page: 1})
		require.NoError(t, err)
		require.Len(t, page1.Items, 2)
		require.True(t, page1.HasMore)
		require.EqualValues(t, 3, page1.TotalCount)

		page2, err := st.listAllThreads(ctx, ListAllThreadsQuery{OrgID: 1, Limit: 2, Page: 2})
		require.NoError(t, err)
		require.Len(t, page2.Items, 1)
		require.False(t, page2.HasMore)
		require.EqualValues(t, 3, page2.TotalCount)

		// First two results plus the third must be the full set with no
		// duplicates and no skips.
		all := append(threadUIDs(page1.Items), threadUIDs(page2.Items)...)
		require.ElementsMatch(t, []string{"aaaaaaaaaaaaaa", "bbbbbbbbbbbbbb", "cccccccccccccc"}, all)
	})
}

func threadUIDs(threads []Thread) []string {
	out := make([]string, 0, len(threads))
	for _, t := range threads {
		out = append(out, t.UID)
	}
	return out
}

func TestIntegrationPulseStore_ListPanelMentions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)

	now := time.Now().UTC()
	const dash = "dash-pm"

	// mentionBody fakes the body AST that the composer would produce
	// for "before #panel:N after". We bypass the body parser here to
	// keep the fixtures small; the parser has its own coverage in
	// body_test.go and inserting the MentionRow directly via
	// insertThreadAndPulse exercises the same denormalized path.
	mentionBody := func(panelID int64) (json.RawMessage, []Mention) {
		raw := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"see #panel:` + strconv.FormatInt(panelID, 10) + ` for context"}]}]}}`)
		return raw, []Mention{{Kind: MentionKindPanel, TargetID: strconv.FormatInt(panelID, 10)}}
	}

	insert := func(uid string, panel *int64, body json.RawMessage, mentions []Mention, lastPulseAt time.Time) {
		t.Helper()
		require.NoError(t, st.insertThreadAndPulse(ctx,
			Thread{
				UID: uid, OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
				PanelID: panel, Title: "thread " + uid,
				CreatedBy: 1, Created: now, Updated: now, LastPulseAt: lastPulseAt,
				PulseCount: 1, Version: 1,
			},
			Pulse{
				UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
				AuthorUserID: 1, AuthorKind: AuthorKindUser,
				BodyText: "x", BodyJSON: body, Created: now, Updated: now,
			},
			mentions,
		))
	}

	pid := func(v int64) *int64 { return &v }

	// Fixture layout (all on the same dashboard):
	//   T1: anchored to panel 5, no mention rows. (older)
	//   T2: not anchored, mentions panel 5. (newest)
	//   T3: anchored to panel 7 AND mentions panel 7 — must dedupe to 1.
	//   T4: not anchored, mentions panel 7. Closed → must be excluded.
	//   T5: anchored to panel 9, but on a *different* dashboard.
	//   T6: not anchored, mentions panel 11. Plain mention only.
	t1Body, _ := sampleBody(t, "anchored to 5")
	insert("t1aaaaaaaaaaaaaa", pid(5), t1Body, nil, now.Add(-30*time.Minute))

	t2Body, t2Mentions := mentionBody(5)
	insert("t2aaaaaaaaaaaaaa", nil, t2Body, t2Mentions, now.Add(-1*time.Minute))

	t3Body, t3Mentions := mentionBody(7)
	insert("t3aaaaaaaaaaaaaa", pid(7), t3Body, t3Mentions, now.Add(-10*time.Minute))

	t4Body, t4Mentions := mentionBody(7)
	insert("t4aaaaaaaaaaaaaa", nil, t4Body, t4Mentions, now.Add(-5*time.Minute))
	require.NoError(t, st.setThreadClosed(ctx, 1, "t4aaaaaaaaaaaaaa", true, 1))

	// Different dashboard, must not surface in the dash-pm rollup.
	otherBody, _ := sampleBody(t, "different dash")
	require.NoError(t, st.insertThreadAndPulse(ctx,
		Thread{
			UID: "t5aaaaaaaaaaaaaa", OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: "dash-other",
			PanelID: pid(9), Title: "elsewhere",
			CreatedBy: 1, Created: now, Updated: now, LastPulseAt: now,
			PulseCount: 1, Version: 1,
		},
		Pulse{
			UID: util.GenerateShortUID(), ThreadUID: "t5aaaaaaaaaaaaaa", OrgID: 1,
			AuthorUserID: 1, AuthorKind: AuthorKindUser,
			BodyText: "x", BodyJSON: otherBody, Created: now, Updated: now,
		},
		nil,
	))

	t6Body, t6Mentions := mentionBody(11)
	insert("t6aaaaaaaaaaaaaa", nil, t6Body, t6Mentions, now.Add(-2*time.Minute))

	got, err := st.listPanelMentions(ctx, ListPanelMentionsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
	})
	require.NoError(t, err)

	// Expected: panel 5 → 2 distinct threads (T1 anchored, T2 mention),
	//   latest is T2 because last_pulse_at is newer.
	// Panel 7 → 1 thread (T3 — anchored AND mentioned, deduped). T4 is
	//   excluded because it's closed.
	// Panel 9 lives on a different dashboard, so the rollup does not
	//   list it.
	// Panel 11 → 1 thread (T6, mention-only).
	require.Len(t, got, 3)

	byPanel := make(map[int64]PanelMentionSummary, len(got))
	for _, s := range got {
		byPanel[s.PanelID] = s
	}

	require.Contains(t, byPanel, int64(5))
	require.EqualValues(t, 2, byPanel[5].ThreadCount)
	require.Equal(t, "t2aaaaaaaaaaaaaa", byPanel[5].LatestThreadUID,
		"panel 5: T2 (mention) is more recent than T1 (anchored), pick it as the click target")

	require.Contains(t, byPanel, int64(7))
	require.EqualValues(t, 1, byPanel[7].ThreadCount,
		"panel 7: T3 anchored+mentioned must dedupe; T4 must be excluded as closed")
	require.Equal(t, "t3aaaaaaaaaaaaaa", byPanel[7].LatestThreadUID)

	require.Contains(t, byPanel, int64(11))
	require.EqualValues(t, 1, byPanel[11].ThreadCount)
	require.Equal(t, "t6aaaaaaaaaaaaaa", byPanel[11].LatestThreadUID)

	require.NotContains(t, byPanel, int64(9), "different-dashboard threads must not appear")

	// Wire format must be sorted by panel id ascending so the JSON
	// payload is byte-stable across calls (the frontend caches by
	// query key + body hash).
	for i := 1; i < len(got); i++ {
		require.Less(t, got[i-1].PanelID, got[i].PanelID,
			"results must be sorted ascending by panel id")
	}
}

func TestIntegrationPulseStore_ListThreads_Filters(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)
	now := time.Now().UTC()
	const dash = "dash-filters"

	mentionBody := func(panelID int64) (json.RawMessage, []Mention) {
		raw := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"see #panel:` + strconv.FormatInt(panelID, 10) + ` for context"}]}]}}`)
		return raw, []Mention{{Kind: MentionKindPanel, TargetID: strconv.FormatInt(panelID, 10)}}
	}
	plain := func(text string) json.RawMessage {
		raw, _ := sampleBody(t, text)
		return raw
	}
	pid := func(v int64) *int64 { return &v }
	uidI64 := func(v int64) *int64 { return &v }

	insert := func(uid string, panel *int64, createdBy int64, body json.RawMessage, mentions []Mention, lastPulseAt time.Time) {
		t.Helper()
		require.NoError(t, st.insertThreadAndPulse(ctx,
			Thread{
				UID: uid, OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
				PanelID: panel, Title: "thread " + uid,
				CreatedBy: createdBy, Created: now, Updated: now, LastPulseAt: lastPulseAt,
				PulseCount: 1, Version: 1,
			},
			Pulse{
				UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
				AuthorUserID: createdBy, AuthorKind: AuthorKindUser,
				BodyText: "x", BodyJSON: body, Created: now, Updated: now,
			},
			mentions,
		))
	}

	// Fixture:
	//   T1: anchored panel 5, started by user 1, no replies. (oldest)
	//   T2: not anchored, mentions panel 5, started by user 2. user 1 replies on it.
	//   T3: anchored panel 7, started by user 3.
	//   T4: not anchored, no panel mention, started by user 1.
	t1Body, _ := sampleBody(t, "anchored to 5 by u1")
	insert("t1bbbbbbbbbbbbbb", pid(5), 1, t1Body, nil, now.Add(-30*time.Minute))

	t2Body, t2Mentions := mentionBody(5)
	insert("t2bbbbbbbbbbbbbb", nil, 2, t2Body, t2Mentions, now.Add(-1*time.Minute))
	// User 1 replies to T2 — proves AuthorUserID filter widens to repliers.
	t2Reply := Pulse{
		UID: util.GenerateShortUID(), ThreadUID: "t2bbbbbbbbbbbbbb", OrgID: 1,
		AuthorUserID: 1, AuthorKind: AuthorKindUser,
		BodyText: "thanks", BodyJSON: plain("thanks"), Created: now, Updated: now,
	}
	_, err := st.insertPulse(ctx, t2Reply, nil)
	require.NoError(t, err)

	t3Body, _ := sampleBody(t, "anchored 7 by u3")
	insert("t3bbbbbbbbbbbbbb", pid(7), 3, t3Body, nil, now.Add(-10*time.Minute))

	t4Body, _ := sampleBody(t, "no panel by u1")
	insert("t4bbbbbbbbbbbbbb", nil, 1, t4Body, nil, now.Add(-20*time.Minute))

	// T5: not anchored, root pulse mentions nothing, but a *reply*
	// mentions panel 5. Locks in the contract that mention rows are
	// per-pulse and the panel filter rolls them up across the whole
	// thread — without this case the listThreads sub-select would
	// silently miss "reply discusses panel 5" threads.
	t5Body, _ := sampleBody(t, "no panel mentioned in root")
	insert("t5bbbbbbbbbbbbbb", nil, 4, t5Body, nil, now.Add(-15*time.Minute))
	t5ReplyRaw, t5ReplyParsed := mentionBody(5)
	_, err = st.insertPulse(ctx,
		Pulse{
			UID: util.GenerateShortUID(), ThreadUID: "t5bbbbbbbbbbbbbb", OrgID: 1,
			AuthorUserID: 4, AuthorKind: AuthorKindUser,
			BodyText: "see #panel:5", BodyJSON: t5ReplyRaw, Created: now, Updated: now,
		},
		t5ReplyParsed,
	)
	require.NoError(t, err)

	// 1) PanelID=5 should match T1 (anchored), T2 (root mentions),
	//    AND T5 (reply mentions). T3/T4 stay out.
	got, err := st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		PanelID: pid(5),
	})
	require.NoError(t, err)
	uids := uidsOf(got.Items)
	require.ElementsMatch(t, []string{"t1bbbbbbbbbbbbbb", "t2bbbbbbbbbbbbbb", "t5bbbbbbbbbbbbbb"}, uids,
		"PanelID filter must lift threads whose only #panel mention lives on a reply")

	// 2) AuthorUserID=1 should match T1 (started), T2 (replied), T4
	//    (started) — but not T3 which user 1 never touched, and not
	//    T5 which is entirely user 4's. The T2 inclusion is the
	//    "reply lifts the parent" contract for the user filter.
	got, err = st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		AuthorUserID: uidI64(1),
	})
	require.NoError(t, err)
	require.ElementsMatch(t,
		[]string{"t1bbbbbbbbbbbbbb", "t2bbbbbbbbbbbbbb", "t4bbbbbbbbbbbbbb"},
		uidsOf(got.Items),
	)

	// 3) Combining filters AND-narrows: PanelID=5 AND AuthorUserID=2
	//    leaves only T2 (mentions panel 5 and started by user 2).
	got, err = st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		PanelID: pid(5), AuthorUserID: uidI64(2),
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"t2bbbbbbbbbbbbbb"}, uidsOf(got.Items))
}

func TestIntegrationPulseStore_ListThreads_QuerySearch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)
	now := time.Now().UTC()
	const dash = "dash-search"

	// Build a thread whose root pulse mentions one needle and whose
	// reply mentions a different needle. The fixture is the heart of
	// the contract under test: a search for the reply's needle should
	// still surface the parent because the user mentally treats the
	// thread as a single unit.
	mkBody := func(text string) (json.RawMessage, *ParsedBody) {
		raw := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"` + text + `"}]}]}}`)
		pb, err := ParseAndValidateBody(raw)
		require.NoError(t, err)
		return raw, pb
	}
	insert := func(uid, title, rootText string, replyTexts []string, lastPulseAt time.Time) {
		t.Helper()
		rootRaw, rootParsed := mkBody(rootText)
		require.NoError(t, st.insertThreadAndPulse(ctx,
			Thread{
				UID: uid, OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
				Title:     title,
				CreatedBy: 1, Created: now, Updated: now, LastPulseAt: lastPulseAt,
				PulseCount: 1, Version: 1,
			},
			Pulse{
				UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
				AuthorUserID: 1, AuthorKind: AuthorKindUser,
				BodyText: rootParsed.Text, BodyJSON: rootRaw, Created: now, Updated: now,
			},
			rootParsed.Mentions,
		))
		for _, rt := range replyTexts {
			rraw, rparsed := mkBody(rt)
			_, err := st.insertPulse(ctx,
				Pulse{
					UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
					AuthorUserID: 1, AuthorKind: AuthorKindUser,
					BodyText: rparsed.Text, BodyJSON: rraw, Created: now, Updated: now,
				},
				rparsed.Mentions,
			)
			require.NoError(t, err)
		}
	}

	// T-A: title says "deploy", body says nothing else interesting.
	insert("qaaaaaaaaaaaaaaa", "Deploy went sideways", "looks normal", nil, now.Add(-30*time.Minute))
	// T-B: title is generic; root pulse mentions "p99 spike".
	insert("qbbbbbbbbbbbbbbb", "Daily review", "p99 spike around 10:00", nil, now.Add(-20*time.Minute))
	// T-C: title + root pulse are both unrelated; only a *reply*
	//   mentions "p99". This is the lift-from-reply case.
	insert("qcccccccccccccc0", "Just checking in", "anything to flag?", []string{"yeah, p99 jumped 4x"}, now.Add(-10*time.Minute))
	// T-D: nothing matches "p99" anywhere — must be excluded.
	insert("qddddddddddddddd", "Notes", "all clear", []string{"agreed"}, now.Add(-5*time.Minute))

	t.Run("title match", func(t *testing.T) {
		got, err := st.listThreads(ctx, ListThreadsQuery{
			OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
			Query: "deploy",
		})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"qaaaaaaaaaaaaaaa"}, uidsOf(got.Items))
	})

	t.Run("root pulse body match", func(t *testing.T) {
		got, err := st.listThreads(ctx, ListThreadsQuery{
			OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
			Query: "P99", // intentionally upper-case to assert case-insensitivity
		})
		require.NoError(t, err)
		// T-B (root pulse) and T-C (reply only) — the latter is the
		// "lift parent into result when child matches" contract.
		require.ElementsMatch(t,
			[]string{"qbbbbbbbbbbbbbbb", "qcccccccccccccc0"},
			uidsOf(got.Items),
		)
	})

	t.Run("reply-only match still lifts the parent thread", func(t *testing.T) {
		got, err := st.listThreads(ctx, ListThreadsQuery{
			OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
			Query: "jumped",
		})
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"qcccccccccccccc0"}, uidsOf(got.Items))
	})

	t.Run("whitespace-only query is treated as no filter", func(t *testing.T) {
		got, err := st.listThreads(ctx, ListThreadsQuery{
			OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
			Query: "   ",
		})
		require.NoError(t, err)
		require.Len(t, got.Items, 4)
	})
}

func TestIntegrationPulseStore_ListParticipantUserIDs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)
	now := time.Now().UTC()
	const dash = "dash-participants"

	body := func(text string) json.RawMessage {
		raw, _ := sampleBody(t, text)
		return raw
	}

	insert := func(uid string, createdBy int64, replyAuthors []int64) {
		t.Helper()
		require.NoError(t, st.insertThreadAndPulse(ctx,
			Thread{
				UID: uid, OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
				CreatedBy: createdBy, Created: now, Updated: now, LastPulseAt: now,
				PulseCount: 1, Version: 1,
			},
			Pulse{
				UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
				AuthorUserID: createdBy, AuthorKind: AuthorKindUser,
				BodyText: "root", BodyJSON: body("root"), Created: now, Updated: now,
			},
			nil,
		))
		for _, a := range replyAuthors {
			_, err := st.insertPulse(ctx,
				Pulse{
					UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
					AuthorUserID: a, AuthorKind: AuthorKindUser,
					BodyText: "r", BodyJSON: body("r"), Created: now, Updated: now,
				},
				nil,
			)
			require.NoError(t, err)
		}
	}

	// User 1 starts T-A; users 2 + 3 reply.
	insert("paaaaaaaaaaaaaaaa", 1, []int64{2, 3})
	// User 2 starts T-B; user 1 replies (already in set).
	insert("pbbbbbbbbbbbbbbbb", 2, []int64{1})
	// Service-account-ish row with id=0 must be excluded.
	insert("pccccccccccccccc0", 4, []int64{0})

	// Different dashboard; participants here must not leak in.
	require.NoError(t, st.insertThreadAndPulse(ctx,
		Thread{
			UID: "pdddddddddddddd0", OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: "dash-other-2",
			CreatedBy: 99, Created: now, Updated: now, LastPulseAt: now, PulseCount: 1, Version: 1,
		},
		Pulse{
			UID: util.GenerateShortUID(), ThreadUID: "pdddddddddddddd0", OrgID: 1,
			AuthorUserID: 99, AuthorKind: AuthorKindUser,
			BodyText: "x", BodyJSON: body("x"), Created: now, Updated: now,
		},
		nil,
	))

	ids, err := st.listParticipantUserIDs(ctx, ListParticipantsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
	})
	require.NoError(t, err)
	// Expected: {1, 2, 3, 4}. User 99 is on a different dashboard,
	// user 0 is the sentinel we drop, no duplicates.
	require.Equal(t, []int64{1, 2, 3, 4}, ids)
}

func TestIntegrationPulseStore_ListThreads_OffsetPagination(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	sql := db.InitTestDB(t)
	st := newStore(sql)
	const dash = "dash-pages"
	base := time.Now().UTC().Add(-1 * time.Hour)

	// Insert 7 threads with strictly-decreasing last_pulse_at so
	// page ordering is deterministic. uid pattern keeps the secondary
	// tiebreaker stable: lexicographic uids align with insertion
	// order, so even if last_pulse_at collided we'd still get a
	// predictable sort.
	mkBody := func() (json.RawMessage, *ParsedBody) { return sampleBody(t, "x") }
	for i := 0; i < 7; i++ {
		uid := fmt.Sprintf("page-%02da-aaaaa", i)
		raw, parsed := mkBody()
		require.NoError(t, st.insertThreadAndPulse(ctx,
			Thread{
				UID: uid, OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
				Title: fmt.Sprintf("t%d", i), CreatedBy: 1,
				Created: base, Updated: base, LastPulseAt: base.Add(time.Duration(i) * time.Minute),
				PulseCount: 1, Version: 1,
			},
			Pulse{
				UID: util.GenerateShortUID(), ThreadUID: uid, OrgID: 1,
				AuthorUserID: 1, AuthorKind: AuthorKindUser,
				BodyText: parsed.Text, BodyJSON: raw, Created: base, Updated: base,
			},
			parsed.Mentions,
		))
	}

	// Page 1 of 3 with limit=3: most recent 3 (index 6, 5, 4).
	got, err := st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		Page: 1, Limit: 3,
	})
	require.NoError(t, err)
	require.Equal(t, 1, got.Page)
	require.EqualValues(t, 7, got.TotalCount)
	require.True(t, got.HasMore, "page 1 of 3 must signal hasMore")
	require.Equal(t,
		[]string{"page-06a-aaaaa", "page-05a-aaaaa", "page-04a-aaaaa"},
		uidsOf(got.Items),
	)

	// Page 2 of 3: indices 3, 2, 1.
	got, err = st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		Page: 2, Limit: 3,
	})
	require.NoError(t, err)
	require.Equal(t, 2, got.Page)
	require.True(t, got.HasMore)
	require.Equal(t,
		[]string{"page-03a-aaaaa", "page-02a-aaaaa", "page-01a-aaaaa"},
		uidsOf(got.Items),
	)

	// Page 3 of 3: only the oldest entry remains; HasMore must flip.
	got, err = st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		Page: 3, Limit: 3,
	})
	require.NoError(t, err)
	require.Equal(t, 3, got.Page)
	require.False(t, got.HasMore, "last page must clear hasMore so the pager can disable Next")
	require.Equal(t, []string{"page-00a-aaaaa"}, uidsOf(got.Items))

	// Out-of-range page should return an empty slice with the same
	// TotalCount so the UI can recover by clamping back to a valid
	// page rather than guessing at a count.
	got, err = st.listThreads(ctx, ListThreadsQuery{
		OrgID: 1, ResourceKind: ResourceKindDashboard, ResourceUID: dash,
		Page: 99, Limit: 3,
	})
	require.NoError(t, err)
	require.Empty(t, got.Items)
	require.EqualValues(t, 7, got.TotalCount)
}

func uidsOf(threads []Thread) []string {
	out := make([]string, len(threads))
	for i, t := range threads {
		out[i] = t.UID
	}
	return out
}

func TestCursorRoundTrip(t *testing.T) {
	c := cursor{Created: "2026-04-28T00:00:00Z", UID: "abc"}
	enc := encodeCursor(c)
	got, err := decodeCursor(enc)
	require.NoError(t, err)
	require.Equal(t, c, got)

	_, err = decodeCursor("not-base64*")
	require.Error(t, err)
}

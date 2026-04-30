package pulse

import (
	"context"
	"encoding/json"
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

func TestCursorRoundTrip(t *testing.T) {
	c := cursor{Created: "2026-04-28T00:00:00Z", UID: "abc"}
	enc := encodeCursor(c)
	got, err := decodeCursor(enc)
	require.NoError(t, err)
	require.Equal(t, c, got)

	_, err = decodeCursor("not-base64*")
	require.Error(t, err)
}

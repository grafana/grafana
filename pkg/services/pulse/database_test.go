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

func TestCursorRoundTrip(t *testing.T) {
	c := cursor{Created: "2026-04-28T00:00:00Z", UID: "abc"}
	enc := encodeCursor(c)
	got, err := decodeCursor(enc)
	require.NoError(t, err)
	require.Equal(t, c, got)

	_, err = decodeCursor("not-base64*")
	require.Error(t, err)
}

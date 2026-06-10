package pulse

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

// newTestService wires up a minimal PulseService against an in-memory
// SQLite store. Live publishing and notifier are no-ops so we can assert
// on store-level outcomes without dragging in the rest of Grafana DI.
func newTestService(t *testing.T) *PulseService {
	t.Helper()
	sql := db.InitTestDB(t)
	return &PulseService{
		cfg:      PulseConfig{MaxBodyBytes: MaxBodyBytes},
		store:    newStore(sql),
		live:     NoopPublisher(),
		notifier: &LogOnlyNotifier{Log: log.New("pulse.test")},
		log:      log.New("pulse.test"),
	}
}

func TestIntegrationPulseService_CreateAndReply(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hello "},{"type":"mention","mention":{"kind":"user","targetId":"42","displayName":"alice"}}]}]}}`)

	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID:        1,
		AuthorUserID: 7,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "abc",
		Title:        "demo",
		Body:         body,
	})
	require.NoError(t, err)
	require.NotEmpty(t, res.Thread.UID)
	require.Equal(t, "hello @alice", res.Pulse.BodyText)

	// Author is auto-subscribed
	subs, err := s.store.listSubscribers(ctx, 1, res.Thread.UID)
	require.NoError(t, err)
	require.Equal(t, []int64{7}, subs)

	// Reply
	reply, err := s.AddPulse(ctx, AddPulseCommand{
		OrgID:        1,
		ThreadUID:    res.Thread.UID,
		AuthorUserID: 8,
		ParentUID:    res.Pulse.UID,
		Body:         json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"reply"}]}]}}`),
	})
	require.NoError(t, err)
	require.Equal(t, "reply", reply.BodyText)

	// Listing returns 2 pulses
	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
}

func TestIntegrationPulseService_EditOnlyByAuthor(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"original"}]}]}}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Body: body,
	})
	require.NoError(t, err)

	// Different user cannot edit
	_, err = s.EditPulse(ctx, EditPulseCommand{
		OrgID: 1, UID: res.Pulse.UID, UserID: 99,
		NewBody: json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"haxx"}]}]}}`),
	})
	require.ErrorIs(t, err, ErrCannotEditNotAuthor)

	// Author can edit
	edited, err := s.EditPulse(ctx, EditPulseCommand{
		OrgID: 1, UID: res.Pulse.UID, UserID: 7,
		NewBody: json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"updated"}]}]}}`),
	})
	require.NoError(t, err)
	require.Equal(t, "updated", edited.BodyText)
	require.True(t, edited.Edited)
}

func TestIntegrationPulseService_DeleteAuthorAndAdmin(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hi"}]}]}}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Body: body,
	})
	require.NoError(t, err)

	// Random user cannot delete
	err = s.DeletePulse(ctx, DeletePulseCommand{OrgID: 1, UID: res.Pulse.UID, UserID: 99})
	require.ErrorIs(t, err, ErrCannotDeleteForbidden)

	// Admin can delete others' pulses
	err = s.DeletePulse(ctx, DeletePulseCommand{OrgID: 1, UID: res.Pulse.UID, UserID: 99, IsAdmin: true})
	require.NoError(t, err)

	// Cannot delete twice
	err = s.DeletePulse(ctx, DeletePulseCommand{OrgID: 1, UID: res.Pulse.UID, UserID: 99, IsAdmin: true})
	require.ErrorIs(t, err, ErrPulseAlreadyDeleted)
}

func TestIntegrationPulseService_ResourceVersionTracksActivity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"v1"}]}]}}`)
	rv0, err := s.GetResourceVersion(ctx, 1, ResourceKindDashboard, "abc")
	require.NoError(t, err)

	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Body: body,
	})
	require.NoError(t, err)

	rv1, err := s.GetResourceVersion(ctx, 1, ResourceKindDashboard, "abc")
	require.NoError(t, err)
	require.Greater(t, rv1.Version, rv0.Version)

	_, err = s.AddPulse(ctx, AddPulseCommand{
		OrgID: 1, ThreadUID: res.Thread.UID, AuthorUserID: 8,
		Body: json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"v2"}]}]}}`),
	})
	require.NoError(t, err)

	rv2, err := s.GetResourceVersion(ctx, 1, ResourceKindDashboard, "abc")
	require.NoError(t, err)
	require.Greater(t, rv2.Version, rv1.Version)
}

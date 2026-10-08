package legacy

import (
	"context"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type recordingBus struct {
	notifications []*resourcepb.WatchNotification
}

func (b *recordingBus) Enabled() bool { return true }

func (b *recordingBus) Publish(_ context.Context, _ string, data []byte) error {
	n := &resourcepb.WatchNotification{}
	if err := proto.Unmarshal(data, n); err != nil {
		return err
	}
	b.notifications = append(b.notifications, n)
	return nil
}

// bindingStore implements the team binding writes the notifying store wraps;
// any other method panics through the nil embedded interface.
type bindingStore struct {
	LegacyIdentityStore
}

func (bindingStore) CreateTeamMember(_ context.Context, _ claims.NamespaceInfo, cmd CreateTeamMemberCommand) (*CreateTeamMemberResult, error) {
	return &CreateTeamMemberResult{TeamMember: TeamMember{UID: cmd.UID, TeamUID: cmd.TeamUID}}, nil
}

func (bindingStore) UpdateTeamMember(_ context.Context, _ claims.NamespaceInfo, cmd UpdateTeamMemberCommand) (*UpdateTeamMemberResult, error) {
	return &UpdateTeamMemberResult{UID: cmd.UID}, nil
}

func (bindingStore) DeleteTeamMember(context.Context, claims.NamespaceInfo, DeleteTeamMemberCommand) error {
	return nil
}

func (bindingStore) ListTeamBindings(_ context.Context, _ claims.NamespaceInfo, query ListTeamBindingsQuery) (*ListTeamBindingsResult, error) {
	return &ListTeamBindingsResult{Bindings: []TeamMember{{UID: query.UID, TeamUID: "team-1"}}}, nil
}

// Team binding writes are announced as a modified team only: members are part
// of the team's spec.
func TestNotifyingStoreTeamBindings(t *testing.T) {
	ctx := context.Background()
	ns := claims.NamespaceInfo{OrgID: 1, Value: "default"}

	type change struct {
		typ      resourcepb.WatchNotification_Type
		resource string
		name     string
	}
	run := func(t *testing.T, write func(LegacyIdentityStore) error) []change {
		t.Helper()
		bus := &recordingBus{}
		store := WithWatchNotifications(bindingStore{}, legacywatch.NewPublisher(bus, claims.OrgNamespaceFormatter))
		require.NoError(t, write(store))
		changes := make([]change, 0, len(bus.notifications))
		for _, n := range bus.notifications {
			require.Equal(t, "default", n.Namespace)
			changes = append(changes, change{n.Type, n.Resource, n.Name})
		}
		return changes
	}

	t.Run("create", func(t *testing.T) {
		got := run(t, func(s LegacyIdentityStore) error {
			_, err := s.CreateTeamMember(ctx, ns, CreateTeamMemberCommand{UID: "binding-1", TeamUID: "team-1"})
			return err
		})
		require.Equal(t, []change{
			{resourcepb.WatchNotification_MODIFIED, "teams", "team-1"},
		}, got)
	})

	t.Run("update", func(t *testing.T) {
		got := run(t, func(s LegacyIdentityStore) error {
			_, err := s.UpdateTeamMember(ctx, ns, UpdateTeamMemberCommand{UID: "binding-1"})
			return err
		})
		require.Equal(t, []change{
			{resourcepb.WatchNotification_MODIFIED, "teams", "team-1"},
		}, got)
	})

	t.Run("delete", func(t *testing.T) {
		got := run(t, func(s LegacyIdentityStore) error {
			return s.DeleteTeamMember(ctx, ns, DeleteTeamMemberCommand{UID: "binding-1"})
		})
		require.Equal(t, []change{
			{resourcepb.WatchNotification_MODIFIED, "teams", "team-1"},
		}, got)
	})
}

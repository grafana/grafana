package userimpl

import (
	"context"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type recordingBus struct {
	subjects      []string
	notifications []*resourcepb.WatchNotification
}

func (b *recordingBus) Enabled() bool { return true }

func (b *recordingBus) Publish(_ context.Context, subject string, data []byte) error {
	n := &resourcepb.WatchNotification{}
	if err := proto.Unmarshal(data, n); err != nil {
		return err
	}
	b.subjects = append(b.subjects, subject)
	b.notifications = append(b.notifications, n)
	return nil
}

func TestLegacyServiceBatchDisableUsersNotifications(t *testing.T) {
	newService := func(store *FakeUserStore, bus *recordingBus) *LegacyService {
		return &LegacyService{
			store:  store,
			tracer: tracing.InitializeTracerForTest(),
			watch:  legacywatch.NewPublisher(bus, claims.OrgNamespaceFormatter),
		}
	}

	t.Run("announces each disabled user, skipping service accounts", func(t *testing.T) {
		bus := &recordingBus{}
		store := &FakeUserStore{ExpectedListUsersByIdOrUid: []*user.User{
			{ID: 1, UID: "u1", OrgID: 1},
			{ID: 2, UID: "sa", OrgID: 1, IsServiceAccount: true},
			{ID: 3, UID: "u3", OrgID: 2},
		}}
		err := newService(store, bus).BatchDisableUsers(context.Background(), &user.BatchDisableUsersCommand{UserIDs: []int64{1, 2, 3}, IsDisabled: true})
		require.NoError(t, err)

		require.Equal(t, []string{
			"legacysql.watch.v1.iam.grafana.app.default.users",
			"legacysql.watch.v1.iam.grafana.app.org-2.users",
		}, bus.subjects)
		for i, name := range []string{"u1", "u3"} {
			require.Equal(t, resourcepb.WatchNotification_MODIFIED, bus.notifications[i].Type)
			require.Equal(t, name, bus.notifications[i].Name)
		}
	})

	t.Run("announces nothing when the write fails", func(t *testing.T) {
		bus := &recordingBus{}
		store := &FakeUserStore{ExpectedError: user.ErrUserNotFound}
		err := newService(store, bus).BatchDisableUsers(context.Background(), &user.BatchDisableUsersCommand{UserIDs: []int64{1}})
		require.ErrorIs(t, err, user.ErrUserNotFound)
		require.Empty(t, bus.notifications)
	})
}

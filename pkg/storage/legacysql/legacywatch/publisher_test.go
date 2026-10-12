package legacywatch

import (
	"context"
	"errors"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type message struct {
	subject string
	data    []byte
}

type fakeBus struct {
	enabled  bool
	err      error
	messages []message
}

func (f *fakeBus) Enabled() bool { return f.enabled }

func (f *fakeBus) Publish(ctx context.Context, subject string, data []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	f.messages = append(f.messages, message{subject: subject, data: data})
	return f.err
}

var users = schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}

func TestPublisher(t *testing.T) {
	t.Run("publishes a notification on the legacy subject", func(t *testing.T) {
		bus := &fakeBus{enabled: true}
		NewPublisher(bus, claims.OrgNamespaceFormatter).Publish(context.Background(), Modified, users, 2, "u1", 1234)

		require.Len(t, bus.messages, 1)
		require.Equal(t, "legacysql.watch.v1.iam.grafana.app.org-2.users", bus.messages[0].subject)
		var got resourcepb.WatchNotification
		require.NoError(t, proto.Unmarshal(bus.messages[0].data, &got))
		require.True(t, proto.Equal(&resourcepb.WatchNotification{
			Type:            resourcepb.WatchNotification_MODIFIED,
			Group:           "iam.grafana.app",
			Resource:        "users",
			Namespace:       "org-2",
			Name:            "u1",
			ResourceVersion: 1234,
		}, &got), "got %v", &got)
	})

	t.Run("publishes after the request is cancelled", func(t *testing.T) {
		bus := &fakeBus{enabled: true}
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		NewPublisher(bus, claims.OrgNamespaceFormatter).Publish(ctx, Deleted, users, 1, "u1", 0)
		require.Len(t, bus.messages, 1)
		require.Equal(t, "legacysql.watch.v1.iam.grafana.app.default.users", bus.messages[0].subject)
	})

	t.Run("drops when disabled", func(t *testing.T) {
		bus := &fakeBus{}
		NewPublisher(bus, claims.OrgNamespaceFormatter).Publish(context.Background(), Added, users, 1, "u1", 0)
		require.Empty(t, bus.messages)
	})

	t.Run("nil publisher and nil bus are no-ops", func(t *testing.T) {
		var p *Publisher
		p.Publish(context.Background(), Added, users, 1, "u1", 0)
		NewPublisher(nil, claims.OrgNamespaceFormatter).Publish(context.Background(), Added, users, 1, "u1", 0)
	})

	t.Run("a publish failure does not panic", func(t *testing.T) {
		bus := &fakeBus{enabled: true, err: errors.New("boom")}
		NewPublisher(bus, claims.OrgNamespaceFormatter).Publish(context.Background(), Added, users, 1, "u1", 0)
		require.Len(t, bus.messages, 1)
	})
}

// A writer that joined a caller's transaction (e.g. SCIM wrapping the user
// service in InTransaction) must not announce before that transaction commits.
func TestPublisherInTransaction(t *testing.T) {
	tracer := tracing.InitializeTracerForTest()
	events := bus.ProvideBus(tracer)
	store := sqlstore.NewTestStore(t, sqlstore.WithTracer(tracer, events), sqlstore.WithoutMigrator())
	nats := &fakeBus{enabled: true}
	p := NewPublisher(nats, claims.OrgNamespaceFormatter)
	events.AddEventListener(p.onNotification)
	ctx := context.Background()

	t.Run("publishes once the transaction commits", func(t *testing.T) {
		nats.messages = nil
		err := store.InTransaction(ctx, func(ctx context.Context) error {
			p.Publish(ctx, Modified, users, 1, "u1", 0)
			require.Empty(t, nats.messages)
			return nil
		})
		require.NoError(t, err)
		require.Len(t, nats.messages, 1)
		require.Equal(t, "legacysql.watch.v1.iam.grafana.app.default.users", nats.messages[0].subject)
	})

	t.Run("waits for the outermost transaction", func(t *testing.T) {
		nats.messages = nil
		err := store.InTransaction(ctx, func(ctx context.Context) error {
			require.NoError(t, store.InTransaction(ctx, func(ctx context.Context) error {
				p.Publish(ctx, Modified, users, 1, "u1", 0)
				return nil
			}))
			require.Empty(t, nats.messages)
			return nil
		})
		require.NoError(t, err)
		require.Len(t, nats.messages, 1)
	})

	t.Run("drops the notification on rollback", func(t *testing.T) {
		nats.messages = nil
		err := store.InTransaction(ctx, func(ctx context.Context) error {
			p.Publish(ctx, Modified, users, 1, "u1", 0)
			return errors.New("rollback")
		})
		require.Error(t, err)
		require.Empty(t, nats.messages)
	})
}

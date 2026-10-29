package permissioncache

import (
	"context"
	"errors"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestRefreshAfterCommit(t *testing.T) {
	for _, tc := range []struct {
		name      string
		requester identity.Requester
		cancel    bool
		err       error
	}{
		{name: "user", requester: &user.SignedInUser{UserID: 7, OrgID: 1}},
		{name: "service account", requester: &user.SignedInUser{UserID: 7, OrgID: 1, IsServiceAccount: true}},
		{name: "failure", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, err: errors.New("AuthZ unavailable")},
		{name: "cancellation", requester: &user.SignedInUser{UserID: 7, OrgID: 1}, cancel: true},
		{name: "nil requester"},
		{name: "anonymous", requester: &identity.StaticRequester{Type: claims.TypeAnonymous}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			type requestKey struct{}
			ctx := context.WithValue(t.Context(), requestKey{}, "metadata")
			spans := tracetest.NewSpanRecorder()
			provider := tracesdk.NewTracerProvider(tracesdk.WithSpanProcessor(spans))
			t.Cleanup(func() { require.NoError(t, provider.Shutdown(context.Background())) })
			ctx, parent := provider.Tracer("test").Start(ctx, "create")
			defer parent.End()
			var deadline time.Time
			if tc.cancel {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, time.Second)
				deadline, _ = ctx.Deadline()
				cancel()
			}
			calls := 0
			service := refreshService{get: func(ctx context.Context, requester identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
				calls++
				require.Same(t, tc.requester, requester)
				require.True(t, options.ReloadCache)
				require.False(t, sqlstore.IsInTransaction(ctx))
				require.Equal(t, "metadata", ctx.Value(requestKey{}))
				got, ok := ctx.Deadline()
				require.True(t, ok)
				if tc.cancel {
					require.ErrorIs(t, ctx.Err(), context.Canceled)
					require.Equal(t, deadline, got)
				} else {
					require.WithinDuration(t, time.Now().Add(5*time.Second), got, time.Second)
				}
				return nil, tc.err
			}}
			cache := &Service{ac: service}
			cache.RefreshAfterCommit(ctx, tc.requester)
			if tc.requester == nil || tc.name == "anonymous" {
				require.Zero(t, calls)
				require.Empty(t, spans.Ended())
				return
			}
			require.Equal(t, 1, calls)
			require.Len(t, spans.Ended(), 1)
			if tc.err != nil {
				require.Equal(t, codes.Error, spans.Ended()[0].Status().Code)
			}
		})
	}
}

type refreshService struct {
	accesscontrol.Service
	get func(context.Context, identity.Requester, accesscontrol.Options) ([]accesscontrol.Permission, error)
}

func (s refreshService) GetUserPermissions(ctx context.Context, requester identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	return s.get(ctx, requester, options)
}

package permissioncache

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestRefreshCreatorTransactionGuard(t *testing.T) {
	for _, tc := range []struct {
		name      string
		session   any
		wantCalls int
	}{
		{name: "no session", wantCalls: 1},
		{name: "typed nil", session: (*sqlstore.DBSession)(nil), wantCalls: 1},
		{name: "unrelated value", session: "not a session", wantCalls: 1},
		{name: "active session", session: &sqlstore.DBSession{}, wantCalls: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := t.Context()
			if tc.session != nil {
				ctx = context.WithValue(ctx, sqlstore.ContextSessionKey{}, tc.session)
			}
			calls := 0
			service := refreshService{get: func(context.Context, identity.Requester, accesscontrol.Options) ([]accesscontrol.Permission, error) {
				calls++
				return nil, nil
			}}
			RefreshCreator(ctx, service, &user.SignedInUser{UserID: 7, OrgID: 1})
			require.Equal(t, tc.wantCalls, calls)
		})
	}
}

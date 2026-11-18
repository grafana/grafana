package personalaccesstokens

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/secretscan"
)

type maintStore struct {
	patstore.Store
	active  []*patstore.Token
	revoked map[int64]string
	cutoff  time.Time
}

func (s *maintStore) ListActive(context.Context) ([]*patstore.Token, error) { return s.active, nil }
func (s *maintStore) RevokeByID(_ context.Context, id int64, reason string) error {
	s.revoked[id] = reason
	return nil
}
func (s *maintStore) DeleteInactiveBefore(_ context.Context, c time.Time) (int64, error) {
	s.cutoff = c
	return 0, nil
}

type leakClient struct {
	leaked []secretscan.Token
	asked  []string
}

func (c *leakClient) CheckTokens(_ context.Context, hashes []string) ([]secretscan.Token, error) {
	c.asked = hashes
	return c.leaked, nil
}

func TestMaintenance(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	t.Run("revokes only reported tokens and sends hashes only", func(t *testing.T) {
		st := &maintStore{revoked: map[int64]string{}, active: []*patstore.Token{{ID: 1, TokenHash: "h1"}, {ID: 2, TokenHash: "h2"}}}
		cl := &leakClient{leaked: []secretscan.Token{{Hash: "h2"}, {Hash: "unknown"}}}
		m := &Maintenance{store: st, client: cl, revoke: true, log: log.NewNopLogger(), now: func() time.Time { return now }}
		require.NoError(t, m.CheckLeaked(context.Background()))
		require.Equal(t, map[int64]string{2: patstore.ReasonSecretLeak}, st.revoked)
		require.ElementsMatch(t, []string{"h1", "h2"}, cl.asked)
	})

	t.Run("notify-only mode does not revoke", func(t *testing.T) {
		st := &maintStore{revoked: map[int64]string{}, active: []*patstore.Token{{ID: 1, TokenHash: "h1"}}}
		m := &Maintenance{store: st, client: &leakClient{leaked: []secretscan.Token{{Hash: "h1"}}}, log: log.NewNopLogger(), now: time.Now}
		require.NoError(t, m.CheckLeaked(context.Background()))
		require.Empty(t, st.revoked)
	})

	t.Run("cleanup applies retention", func(t *testing.T) {
		st := &maintStore{}
		m := &Maintenance{store: st, log: log.NewNopLogger(), now: func() time.Time { return now }}
		require.NoError(t, m.Cleanup(context.Background()))
		require.Equal(t, now.Add(-retention), st.cutoff)
	})
}

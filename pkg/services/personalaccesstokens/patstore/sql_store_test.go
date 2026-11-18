package patstore

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func newTestStore(t *testing.T) (*sqlStore, *time.Time) {
	t.Helper()
	sql, _ := sqlstore.InitTestDB(t)
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	return &sqlStore{db: sql, now: func() time.Time { return now }}, &now
}

func create(t *testing.T, s *sqlStore, userID, orgID int64, name, hash string, exp *time.Time) *Token {
	t.Helper()
	tok, err := s.Create(context.Background(), CreateCommand{
		UserID: userID, OrgID: orgID, Name: name, TokenHash: hash, PrefixHint: "abcd", ExpiresAt: exp,
	})
	require.NoError(t, err)
	return tok
}

func TestIntegrationPATStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	t.Run("create and get by hash", func(t *testing.T) {
		s, now := newTestStore(t)
		exp := now.Add(time.Hour)
		created := create(t, s, 1, 1, "ci", "hash1", &exp)
		require.NotEmpty(t, created.UID)

		got, err := s.GetByHash(ctx, "hash1")
		require.NoError(t, err)
		require.Equal(t, "ci", got.Name)
		require.Equal(t, int64(1), got.UserID)
		require.False(t, got.IsRevoked())
		require.False(t, got.IsExpired(*now))
		require.True(t, got.IsExpired(now.Add(2*time.Hour)))

		_, err = s.GetByHash(ctx, "missing")
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("token hash is unique", func(t *testing.T) {
		s, _ := newTestStore(t)
		create(t, s, 1, 1, "a", "dup", nil)
		_, err := s.Create(ctx, CreateCommand{UserID: 2, OrgID: 1, Name: "b", TokenHash: "dup", PrefixHint: "abcd"})
		require.Error(t, err)
	})

	t.Run("revoke is scoped to owner and org", func(t *testing.T) {
		s, _ := newTestStore(t)
		tok := create(t, s, 1, 1, "a", "h", nil)

		require.ErrorIs(t, s.Revoke(ctx, 1, 2, tok.UID, ReasonUser), ErrNotFound)
		require.ErrorIs(t, s.Revoke(ctx, 2, 1, tok.UID, ReasonUser), ErrNotFound)
		require.NoError(t, s.Revoke(ctx, 1, 1, tok.UID, ReasonUser))
		require.ErrorIs(t, s.Revoke(ctx, 1, 1, tok.UID, ReasonAdmin), ErrNotFound)

		got, err := s.GetByHash(ctx, "h")
		require.NoError(t, err)
		require.True(t, got.IsRevoked())
		require.Equal(t, ReasonUser, got.RevokedReason)
	})

	t.Run("list active and revoke by id", func(t *testing.T) {
		s, now := newTestStore(t)
		past := now.Add(-time.Hour)
		create(t, s, 1, 1, "expired", "he", &past)
		live := create(t, s, 1, 1, "live", "hl", nil)
		gone := create(t, s, 1, 1, "gone", "hg", nil)
		require.NoError(t, s.RevokeByID(ctx, gone.ID, ReasonSecretLeak))
		require.ErrorIs(t, s.RevokeByID(ctx, gone.ID, ReasonSecretLeak), ErrNotFound)

		active, err := s.ListActive(ctx)
		require.NoError(t, err)
		require.Len(t, active, 1)
		require.Equal(t, live.ID, active[0].ID)
	})

	t.Run("revoke all for user and org", func(t *testing.T) {
		s, _ := newTestStore(t)
		create(t, s, 1, 1, "a", "h1", nil)
		create(t, s, 1, 2, "b", "h2", nil)
		create(t, s, 2, 1, "c", "h3", nil)

		n, err := s.RevokeAllForUserInOrg(ctx, 1, 1, ReasonOrgRemoved)
		require.NoError(t, err)
		require.Equal(t, int64(1), n)

		n, err = s.RevokeAllForUser(ctx, 1, ReasonUserDisabled)
		require.NoError(t, err)
		require.Equal(t, int64(1), n) // already-revoked token is not re-stamped

		first, err := s.GetByHash(ctx, "h1")
		require.NoError(t, err)
		require.Equal(t, ReasonOrgRemoved, first.RevokedReason)
		other, err := s.GetByHash(ctx, "h3")
		require.NoError(t, err)
		require.False(t, other.IsRevoked())
	})

	t.Run("list and count active", func(t *testing.T) {
		s, now := newTestStore(t)
		past := now.Add(-time.Minute)
		future := now.Add(time.Hour)
		create(t, s, 1, 1, "active", "h1", &future)
		create(t, s, 1, 1, "forever", "h2", nil)
		create(t, s, 1, 1, "expired", "h3", &past)
		revoked := create(t, s, 1, 1, "revoked", "h4", nil)
		require.NoError(t, s.Revoke(ctx, 1, 1, revoked.UID, ReasonUser))
		create(t, s, 2, 1, "other user", "h5", nil)

		list, err := s.ListByUser(ctx, 1, 1)
		require.NoError(t, err)
		require.Len(t, list, 4)

		n, err := s.CountActiveByUser(ctx, 1, 1)
		require.NoError(t, err)
		require.Equal(t, int64(2), n)
	})

	t.Run("touch last used", func(t *testing.T) {
		s, _ := newTestStore(t)
		tok := create(t, s, 1, 1, "a", "h", nil)
		require.NoError(t, s.TouchLastUsed(ctx, tok.ID, UsageInfo{IP: "10.0.0.1", UserAgent: "curl"}))
		got, err := s.GetByHash(ctx, "h")
		require.NoError(t, err)
		require.NotNil(t, got.LastUsedAt)
		require.Equal(t, "10.0.0.1", got.LastUsedIP)
		require.Equal(t, "curl", got.LastUsedUA)
	})

	t.Run("delete inactive before cutoff", func(t *testing.T) {
		s, now := newTestStore(t)
		past := now.Add(-48 * time.Hour)
		future := now.Add(time.Hour)
		create(t, s, 1, 1, "expired", "h1", &past)
		create(t, s, 1, 1, "live", "h2", &future)
		revoked := create(t, s, 1, 1, "revoked", "h3", nil)
		require.NoError(t, s.Revoke(ctx, 1, 1, revoked.UID, ReasonUser))

		n, err := s.DeleteInactiveBefore(ctx, now.Add(-24*time.Hour))
		require.NoError(t, err)
		require.Equal(t, int64(1), n) // revoked "now" is newer than the cutoff

		n, err = s.DeleteInactiveBefore(ctx, now.Add(time.Minute))
		require.NoError(t, err)
		require.Equal(t, int64(1), n)

		_, err = s.GetByHash(ctx, "h2")
		require.NoError(t, err)
	})
}

func TestIntegrationPATStoreSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()
	s, now := newTestStore(t)
	past, soon, later := now.Add(-time.Hour), now.Add(24*time.Hour), now.Add(30*24*time.Hour)
	create(t, s, 1, 1, "ci-active", "h1", &soon)
	create(t, s, 2, 1, "expired", "h2", &past)
	create(t, s, 2, 2, "other-org", "h3", &later)
	revoked := create(t, s, 3, 1, "100%_done", "h4", nil)
	require.NoError(t, s.Revoke(ctx, 1, 3, revoked.UID, ReasonAdmin))

	names := func(q SearchQuery) []string {
		res, err := s.Search(ctx, q)
		require.NoError(t, err)
		out := []string{}
		for _, tok := range res.Tokens {
			out = append(out, tok.Name)
		}
		return out
	}

	require.ElementsMatch(t, []string{"ci-active", "expired", "100%_done"}, names(SearchQuery{OrgID: 1}))
	require.Len(t, names(SearchQuery{}), 4)
	require.Equal(t, []string{"ci-active"}, names(SearchQuery{OrgID: 1, Status: StatusActive}))
	require.Equal(t, []string{"expired"}, names(SearchQuery{OrgID: 1, Status: StatusExpired}))
	require.Equal(t, []string{"100%_done"}, names(SearchQuery{Status: StatusRevoked}))
	require.Equal(t, []string{"100%_done"}, names(SearchQuery{Query: "100%"}))
	require.Empty(t, names(SearchQuery{Query: "%zzz"}))
	require.Equal(t, []string{"other-org"}, names(SearchQuery{UserID: 2, OrgID: 2}))
	require.Equal(t, []string{"ci-active"}, names(SearchQuery{ExpiringBefore: &later, OrgID: 1, Status: StatusActive}))

	require.Equal(t, []string{"100%_done", "ci-active", "expired", "other-org"}, names(SearchQuery{SortBy: "name"}))
	require.Equal(t, []string{"other-org", "expired", "ci-active", "100%_done"}, names(SearchQuery{SortBy: "name", SortDesc: true}))
	// nil expiry sorts last in both directions
	require.Equal(t, []string{"expired", "ci-active", "other-org", "100%_done"}, names(SearchQuery{SortBy: "expires"}))
	require.Equal(t, []string{"other-org", "ci-active", "expired", "100%_done"}, names(SearchQuery{SortBy: "expires", SortDesc: true}))
	byStatus := names(SearchQuery{SortBy: "status", SortDesc: true})
	require.Equal(t, "100%_done", byStatus[0])
	require.Equal(t, "expired", byStatus[1])
	require.Equal(t, names(SearchQuery{}), names(SearchQuery{SortBy: "'; DROP TABLE x; --"}))

	res, err := s.Search(ctx, SearchQuery{Limit: 2, Page: 2})
	require.NoError(t, err)
	require.EqualValues(t, 4, res.Total)
	require.Len(t, res.Tokens, 2)

	got, err := s.GetByUID(ctx, revoked.UID)
	require.NoError(t, err)
	require.Equal(t, "100%_done", got.Name)
	_, err = s.GetByUID(ctx, "nope")
	require.ErrorIs(t, err, ErrNotFound)
}

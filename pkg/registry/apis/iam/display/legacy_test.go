package display

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/user"
)

type fakeLegacyIdentityStore struct {
	gotQuery legacy.ListDisplayQuery
	gotNS    authlib.NamespaceInfo
	result   *legacy.ListUserResult
	err      error
}

func (f *fakeLegacyIdentityStore) ListDisplay(_ context.Context, ns authlib.NamespaceInfo, q legacy.ListDisplayQuery) (*legacy.ListUserResult, error) {
	f.gotQuery = q
	f.gotNS = ns
	if f.err != nil {
		return nil, f.err
	}
	return f.result, nil
}

func TestLegacyDisplayProvider_GetDisplayList(t *testing.T) {
	ctx := context.Background()
	ns := authlib.NamespaceInfo{Value: "default", OrgID: 7}

	t.Run("empty input returns an empty list and queries the store with no keys", func(t *testing.T) {
		store := &fakeLegacyIdentityStore{result: &legacy.ListUserResult{}}
		p := NewLegacyDisplayProvider(store)

		got, err := p.GetDisplayList(ctx, ns, nil)
		require.NoError(t, err)

		require.Equal(t, int64(7), store.gotQuery.OrgID)
		require.Empty(t, store.gotQuery.UIDs)
		require.Empty(t, store.gotQuery.IDs)

		require.Empty(t, got.Items)
		require.Empty(t, got.InvalidKeys)
		require.Nil(t, got.Keys)
	})

	t.Run("store error is propagated", func(t *testing.T) {
		boom := errors.New("boom")
		p := NewLegacyDisplayProvider(&fakeLegacyIdentityStore{err: boom})

		got, err := p.GetDisplayList(ctx, ns, []string{"some-uid"})
		require.ErrorIs(t, err, boom)
		require.Nil(t, got)
	})

	t.Run("parsed keys are forwarded to the store and original keys are echoed back", func(t *testing.T) {
		store := &fakeLegacyIdentityStore{result: &legacy.ListUserResult{}}
		p := NewLegacyDisplayProvider(store)

		input := []string{"42", "user:7", "some-uid", "bogus:1"}
		got, err := p.GetDisplayList(ctx, ns, input)
		require.NoError(t, err)

		require.Equal(t, int64(7), store.gotQuery.OrgID)
		require.Equal(t, []int64{42, 7}, store.gotQuery.IDs)
		require.Equal(t, []string{"some-uid"}, store.gotQuery.UIDs)

		require.Equal(t, input, got.Keys)
		require.Equal(t, []string{"bogus:1"}, got.InvalidKeys)
	})

	t.Run("user result is mapped to a Display with name fallback, avatar, and internal id", func(t *testing.T) {
		store := &fakeLegacyIdentityStore{result: &legacy.ListUserResult{
			Items: []common.UserWithRole{
				{User: user.User{ID: 1, UID: "u1", Name: "Alice", Email: "alice@example.com"}},
				{User: user.User{ID: 2, UID: "u2", Login: "bob"}},
				{User: user.User{ID: 3, UID: "u3", Email: "carol@example.com"}},
			},
		}}
		p := NewLegacyDisplayProvider(store)

		got, err := p.GetDisplayList(ctx, ns, []string{"u1", "u2", "u3"})
		require.NoError(t, err)
		require.Len(t, got.Items, 3)

		require.Equal(t, iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"}, got.Items[0].Identity)
		require.Equal(t, "Alice", got.Items[0].DisplayName)
		require.Equal(t, int64(1), got.Items[0].InternalID)
		require.NotEmpty(t, got.Items[0].AvatarURL)

		require.Equal(t, "bob", got.Items[1].DisplayName, "falls back to login when Name is empty")
		require.Equal(t, "carol@example.com", got.Items[2].DisplayName, "falls back to email when Name and Login are empty")
	})

	t.Run("service account users get the service-account identity type", func(t *testing.T) {
		store := &fakeLegacyIdentityStore{result: &legacy.ListUserResult{
			Items: []common.UserWithRole{
				{User: user.User{ID: 10, UID: "sa1", Name: "svc", IsServiceAccount: true}},
			},
		}}
		p := NewLegacyDisplayProvider(store)

		got, err := p.GetDisplayList(ctx, ns, []string{"sa1"})
		require.NoError(t, err)
		require.Len(t, got.Items, 1)
		require.Equal(t, authlib.TypeServiceAccount, got.Items[0].Identity.Type)
		require.Equal(t, "sa1", got.Items[0].Identity.Name)
	})

	t.Run("terminal display entries from key parsing are appended after store results", func(t *testing.T) {
		store := &fakeLegacyIdentityStore{result: &legacy.ListUserResult{
			Items: []common.UserWithRole{
				{User: user.User{ID: 1, UID: "u1", Name: "Alice"}},
			},
		}}
		p := NewLegacyDisplayProvider(store)

		got, err := p.GetDisplayList(ctx, ns, []string{"u1", "0", "anonymous:", "api-key:k1"})
		require.NoError(t, err)
		require.Len(t, got.Items, 4)

		require.Equal(t, "Alice", got.Items[0].DisplayName)
		require.Equal(t, "System admin", got.Items[1].DisplayName)
		require.Equal(t, "Anonymous", got.Items[2].DisplayName)
		require.Equal(t, "API Key", got.Items[3].DisplayName)
	})
}

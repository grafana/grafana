package cleaner

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

type fakeRegistryServiceUnchecked struct {
	deleteErr   error
	deletedOrgs []int64
	deletedUIDs [][]string
	gotCtx      context.Context
}

func (f *fakeRegistryServiceUnchecked) DeleteInFoldersUnchecked(ctx context.Context, orgID int64, folderUIDs []string, _ identity.Requester) error {
	f.gotCtx = ctx
	f.deletedOrgs = append(f.deletedOrgs, orgID)
	f.deletedUIDs = append(f.deletedUIDs, folderUIDs)
	return f.deleteErr
}

func TestUncheckedContentsCleaner_DeleteInFolder(t *testing.T) {
	// org-2 -> OrgID 2; a service identity still enumerates, as the cascade does, but the real
	// requester is passed in explicitly for attribution.
	ctx := identity.WithServiceIdentityContext(context.Background(), 2)
	user := &identity.StaticRequester{UserUID: "real-user", OrgID: 2, Namespace: "org-2"}

	t.Run("deletes in every registered service, unchecked, passing ctx through unchanged", func(t *testing.T) {
		// The caller (cascadeDeleteStorage) is the one that marks ctx authorized; this cleaner
		// performs no check or marking of its own, so a pre-marked ctx must reach the delete funcs as-is.
		markedCtx := folder.WithUncheckedDeleteAuthorized(ctx, 2, user, []string{"fold1"}, true)
		a := &fakeRegistryServiceUnchecked{}
		b := &fakeRegistryServiceUnchecked{}
		c := NewUncheckedContentsCleaner(a, b)

		require.NoError(t, c.DeleteInFolder(markedCtx, "org-2", "fold1", user))

		assert.Equal(t, [][]string{{"fold1"}}, a.deletedUIDs)
		assert.Equal(t, []int64{2}, a.deletedOrgs)
		assert.Equal(t, [][]string{{"fold1"}}, b.deletedUIDs)
		assert.True(t, folder.IsUncheckedDeleteAuthorized(a.gotCtx, 2, user, []string{"fold1"}))
	})

	t.Run("propagates the first cleanup error", func(t *testing.T) {
		wantErr := errors.New("boom")
		c := NewUncheckedContentsCleaner(&fakeRegistryServiceUnchecked{deleteErr: wantErr})

		assert.ErrorIs(t, c.DeleteInFolder(ctx, "org-2", "fold1", user), wantErr)
	})

	t.Run("errors on an invalid namespace", func(t *testing.T) {
		c := NewUncheckedContentsCleaner(&fakeRegistryServiceUnchecked{})
		assert.Error(t, c.DeleteInFolder(ctx, "org-notanumber", "fold1", user))
	})
}

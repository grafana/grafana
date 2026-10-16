package cleaner

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeRegistryServiceUnchecked struct {
	deleteErr   error
	deletedOrgs []int64
	deletedUIDs [][]string
}

func (f *fakeRegistryServiceUnchecked) DeleteInFoldersUnchecked(_ context.Context, orgID int64, folderUIDs []string, _ identity.Requester) error {
	f.deletedOrgs = append(f.deletedOrgs, orgID)
	f.deletedUIDs = append(f.deletedUIDs, folderUIDs)
	return f.deleteErr
}

func TestUncheckedContentsCleaner_DeleteInFolder(t *testing.T) {
	// org-2 -> OrgID 2; a service identity supplies the requester, as the cascade does.
	ctx := identity.WithServiceIdentityContext(context.Background(), 2)

	t.Run("deletes in every registered service, unchecked", func(t *testing.T) {
		a := &fakeRegistryServiceUnchecked{}
		b := &fakeRegistryServiceUnchecked{}
		c := NewUncheckedContentsCleaner(a, b)

		require.NoError(t, c.DeleteInFolder(ctx, "org-2", "fold1"))

		assert.Equal(t, [][]string{{"fold1"}}, a.deletedUIDs)
		assert.Equal(t, []int64{2}, a.deletedOrgs)
		assert.Equal(t, [][]string{{"fold1"}}, b.deletedUIDs)
	})

	t.Run("propagates the first cleanup error", func(t *testing.T) {
		wantErr := errors.New("boom")
		c := NewUncheckedContentsCleaner(&fakeRegistryServiceUnchecked{deleteErr: wantErr})

		assert.ErrorIs(t, c.DeleteInFolder(ctx, "org-2", "fold1"), wantErr)
	})

	t.Run("errors on an invalid namespace", func(t *testing.T) {
		c := NewUncheckedContentsCleaner(&fakeRegistryServiceUnchecked{})
		assert.Error(t, c.DeleteInFolder(ctx, "org-notanumber", "fold1"))
	})

	t.Run("errors, without deleting anything, when the requester's org doesn't match the namespace", func(t *testing.T) {
		a := &fakeRegistryServiceUnchecked{}
		b := &fakeRegistryServiceUnchecked{}
		c := NewUncheckedContentsCleaner(a, b)

		// ctx carries org 2, namespace says org 3.
		require.Error(t, c.DeleteInFolder(ctx, "org-3", "fold1"))

		assert.Empty(t, a.deletedUIDs, "must not delete anything in the first service")
		assert.Empty(t, b.deletedUIDs, "must not delete anything in the second service")
	})
}

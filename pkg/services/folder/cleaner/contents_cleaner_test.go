package cleaner

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeRegistryService struct {
	deleteErr   error
	deletedOrgs []int64
	deletedUIDs [][]string
}

func (f *fakeRegistryService) DeleteInFolders(_ context.Context, orgID int64, folderUIDs []string, _ identity.Requester) error {
	f.deletedOrgs = append(f.deletedOrgs, orgID)
	f.deletedUIDs = append(f.deletedUIDs, folderUIDs)
	return f.deleteErr
}

func (f *fakeRegistryService) CountInFolders(context.Context, int64, []string, identity.Requester) (int64, error) {
	return 0, nil
}

func (f *fakeRegistryService) Kind() string { return "" }

func TestContentsCleaner_DeleteInFolder(t *testing.T) {
	// org-2 -> OrgID 2; a service identity supplies the requester, as the cascade does.
	ctx := identity.WithServiceIdentityContext(context.Background(), 2)

	t.Run("deletes in every registered service", func(t *testing.T) {
		a := &fakeRegistryService{}
		b := &fakeRegistryService{}
		c := NewContentsCleaner(a, b)

		require.NoError(t, c.DeleteInFolder(ctx, "org-2", "fold1"))

		assert.Equal(t, [][]string{{"fold1"}}, a.deletedUIDs)
		assert.Equal(t, []int64{2}, a.deletedOrgs)
		assert.Equal(t, [][]string{{"fold1"}}, b.deletedUIDs)
	})

	t.Run("propagates the first cleanup error", func(t *testing.T) {
		wantErr := errors.New("boom")
		c := NewContentsCleaner(&fakeRegistryService{deleteErr: wantErr})

		assert.ErrorIs(t, c.DeleteInFolder(ctx, "org-2", "fold1"), wantErr)
	})

	t.Run("errors on an invalid namespace", func(t *testing.T) {
		c := NewContentsCleaner(&fakeRegistryService{})
		assert.Error(t, c.DeleteInFolder(ctx, "org-notanumber", "fold1"))
	})
}

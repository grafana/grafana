package cleaner

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

type fakeRegistryService struct {
	deleteErr   error
	deletedOrgs []int64
	deletedUIDs [][]string
	deletedBy   []identity.Requester
}

func (f *fakeRegistryService) DeleteInFolders(_ context.Context, orgID int64, folderUIDs []string, user identity.Requester) error {
	f.deletedOrgs = append(f.deletedOrgs, orgID)
	f.deletedUIDs = append(f.deletedUIDs, folderUIDs)
	f.deletedBy = append(f.deletedBy, user)
	return f.deleteErr
}

func (f *fakeRegistryService) CountInFolders(context.Context, int64, []string, identity.Requester) (int64, error) {
	return 0, nil
}

func (f *fakeRegistryService) Kind() string { return "" }

func TestContentsCleaner_DeleteInFolder(t *testing.T) {
	// org-2 -> OrgID 2; a service identity still enumerates, as the cascade does, but the real
	// requester is passed in explicitly for attribution.
	ctx := identity.WithServiceIdentityContext(context.Background(), 2)
	user := &identity.StaticRequester{UserUID: "real-user", OrgID: 2, Namespace: "org-2"}

	t.Run("deletes in every registered service", func(t *testing.T) {
		a := &fakeRegistryService{}
		b := &fakeRegistryService{}
		c := NewContentsCleaner(a, b)

		require.NoError(t, c.DeleteInFolder(ctx, "org-2", "fold1", user))

		assert.Equal(t, [][]string{{"fold1"}}, a.deletedUIDs)
		assert.Equal(t, []int64{2}, a.deletedOrgs)
		assert.Equal(t, [][]string{{"fold1"}}, b.deletedUIDs)
		assert.Equal(t, []identity.Requester{user}, a.deletedBy, "the real requester, not the service identity, must be attributed")
	})

	t.Run("propagates the first cleanup error", func(t *testing.T) {
		wantErr := errors.New("boom")
		c := NewContentsCleaner(&fakeRegistryService{deleteErr: wantErr})

		assert.ErrorIs(t, c.DeleteInFolder(ctx, "org-2", "fold1", user), wantErr)
	})

	t.Run("errors on an invalid namespace", func(t *testing.T) {
		c := NewContentsCleaner(&fakeRegistryService{})
		assert.Error(t, c.DeleteInFolder(ctx, "org-notanumber", "fold1", user))
	})

	t.Run("errors, without deleting anything, when the requester's namespace doesn't match the target namespace", func(t *testing.T) {
		a := &fakeRegistryService{}
		c := NewContentsCleaner(a)

		// user is namespace org-2, target namespace is org-3.
		err := c.DeleteInFolder(ctx, "org-3", "fold1", user)
		require.ErrorIs(t, err, folder.ErrAccessDenied, "must be classifiable as an access-denial, not a generic error, so callers map it to 403 rather than 500")
		assert.Empty(t, a.deletedUIDs, "must not delete anything on the checked path either")
	})

	t.Run("a Grafana Admin is exempt from the namespace match, same as the apiserver's own namespaceAuthorizer", func(t *testing.T) {
		a := &fakeRegistryService{}
		c := NewContentsCleaner(a)
		admin := &identity.StaticRequester{UserUID: "admin-user", OrgID: 1, Namespace: "org-2", IsGrafanaAdmin: true}

		// admin's own namespace is org-2, target namespace is org-3.
		require.NoError(t, c.DeleteInFolder(ctx, "org-3", "fold1", admin))
		assert.Equal(t, [][]string{{"fold1"}}, a.deletedUIDs)
	})

	t.Run("an anonymous identity is exempt from the namespace match, same as the apiserver's own namespaceAuthorizer", func(t *testing.T) {
		a := &fakeRegistryService{}
		c := NewContentsCleaner(a)
		anon := &identity.StaticRequester{UserUID: "anon-user", OrgID: 1, Namespace: "org-2", Type: claims.TypeAnonymous}

		// anon's own namespace is org-2, target namespace is org-3.
		require.NoError(t, c.DeleteInFolder(ctx, "org-3", "fold1", anon))
		assert.Equal(t, [][]string{{"fold1"}}, a.deletedUIDs)
	})

	t.Run("errors, without panicking, on a nil requester", func(t *testing.T) {
		var nilUser *identity.StaticRequester
		a := &fakeRegistryService{}
		c := NewContentsCleaner(a)

		var err error
		assert.NotPanics(t, func() {
			err = c.DeleteInFolder(ctx, "org-2", "fold1", nilUser)
		})
		assert.ErrorIs(t, err, folder.ErrAccessDenied)
		assert.Empty(t, a.deletedUIDs)
	})
}

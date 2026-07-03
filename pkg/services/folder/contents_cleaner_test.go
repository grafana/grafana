package folder

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type fakeRegistryService struct {
	kind        string
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

func (f *fakeRegistryService) Kind() string { return f.kind }

func TestContentsCleaner_DeleteInFolder(t *testing.T) {
	// org-2 -> OrgID 2; a service identity supplies the requester, as the cascade does.
	ctx := identity.WithServiceIdentityContext(context.Background(), 2)

	t.Run("deletes alert rules and library elements, skips dashboards", func(t *testing.T) {
		alertRules := &fakeRegistryService{kind: entity.StandardKindAlertRule}
		libPanels := &fakeRegistryService{kind: entity.StandardKindLibraryPanel}
		dashboards := &fakeRegistryService{kind: entity.StandardKindDashboard}

		c := NewContentsCleaner()
		c.Register(alertRules)
		c.Register(libPanels)
		c.Register(dashboards)

		require.NoError(t, c.DeleteInFolder(ctx, "org-2", "fold1"))

		assert.Equal(t, [][]string{{"fold1"}}, alertRules.deletedUIDs)
		assert.Equal(t, []int64{2}, alertRules.deletedOrgs)
		assert.Equal(t, [][]string{{"fold1"}}, libPanels.deletedUIDs)
		assert.Nil(t, dashboards.deletedUIDs, "dashboards must not be deleted by the cleaner")
	})

	t.Run("propagates the first cleanup error", func(t *testing.T) {
		wantErr := errors.New("boom")
		c := NewContentsCleaner()
		c.Register(&fakeRegistryService{kind: entity.StandardKindAlertRule, deleteErr: wantErr})

		assert.ErrorIs(t, c.DeleteInFolder(ctx, "org-2", "fold1"), wantErr)
	})

	t.Run("errors on an invalid namespace", func(t *testing.T) {
		c := NewContentsCleaner()
		assert.Error(t, c.DeleteInFolder(ctx, "org-notanumber", "fold1"))
	})
}

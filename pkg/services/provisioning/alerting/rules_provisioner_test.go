package alerting

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	alert_models "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func newTestRuleProvisioner(t *testing.T, folders ...*folder.Folder) (*defaultAlertRuleProvisioner, *dashboards.FakeDashboardProvisioning) {
	t.Helper()

	folderSvc := foldertest.NewFakeService()
	folderSvc.ExpectedError = dashboards.ErrFolderNotFound
	for _, f := range folders {
		folderSvc.AddFolder(f)
	}
	dashProv := dashboards.NewFakeDashboardProvisioning(t)

	return &defaultAlertRuleProvisioner{
		logger:               log.NewNopLogger(),
		folderService:        folderSvc,
		dashboardProvService: dashProv,
	}, dashProv
}

func groupWithFolder(fullpath, uid string) alert_models.AlertRuleGroupWithFolderFullpath {
	return alert_models.AlertRuleGroupWithFolderFullpath{
		AlertRuleGroup: &alert_models.AlertRuleGroup{Title: "group", FolderUID: uid},
		OrgID:          1,
		FolderFullpath: fullpath,
	}
}

func matchCreate(uid, title, parentUID string) any {
	return mock.MatchedBy(func(cmd *folder.CreateFolderCommand) bool {
		if uid != "" && cmd.UID != uid {
			return false
		}
		return cmd.Title == title && cmd.ParentUID == parentUID && cmd.OrgID == 1
	})
}

func TestRuleProvisionerResolveFolder(t *testing.T) {
	ctx := context.Background()

	t.Run("uses the existing folder with the given uid", func(t *testing.T) {
		prov, _ := newTestRuleProvisioner(t,
			&folder.Folder{UID: "test", Title: "Test", OrgID: 1},
			&folder.Folder{UID: "other", Title: "Test", OrgID: 1},
		)

		uid, err := prov.resolveFolder(ctx, groupWithFolder("Test", "test"))
		require.NoError(t, err)
		require.Equal(t, "test", uid)
	})

	t.Run("uses the existing folder with the given uid when no title is set", func(t *testing.T) {
		prov, _ := newTestRuleProvisioner(t, &folder.Folder{UID: "test", Title: "Test", OrgID: 1})

		uid, err := prov.resolveFolder(ctx, groupWithFolder("", "test"))
		require.NoError(t, err)
		require.Equal(t, "test", uid)
	})

	t.Run("creates the folder with the given uid when it does not exist", func(t *testing.T) {
		prov, dashProv := newTestRuleProvisioner(t)
		dashProv.On("SaveFolderForProvisionedDashboards", mock.Anything, matchCreate("test", "Test", ""), "").
			Return(&folder.Folder{UID: "test", Title: "Test", OrgID: 1}, nil).Once()

		uid, err := prov.resolveFolder(ctx, groupWithFolder("Test", "test"))
		require.NoError(t, err)
		require.Equal(t, "test", uid)
	})

	t.Run("creates the leaf folder with the given uid under a nested path", func(t *testing.T) {
		prov, dashProv := newTestRuleProvisioner(t, &folder.Folder{UID: "parent", Title: "Parent", OrgID: 1})
		dashProv.On("SaveFolderForProvisionedDashboards", mock.Anything, matchCreate("child", "Child", "parent"), "").
			Return(&folder.Folder{UID: "child", Title: "Child", ParentUID: "parent", OrgID: 1}, nil).Once()

		uid, err := prov.resolveFolder(ctx, groupWithFolder("Parent/Child", "child"))
		require.NoError(t, err)
		require.Equal(t, "child", uid)
	})

	t.Run("creates missing parents by title under a nested path", func(t *testing.T) {
		prov, dashProv := newTestRuleProvisioner(t)
		dashProv.On("SaveFolderForProvisionedDashboards", mock.Anything, matchCreate("", "Parent", ""), "").
			Return(&folder.Folder{UID: "generated", Title: "Parent", OrgID: 1}, nil).Once()
		dashProv.On("SaveFolderForProvisionedDashboards", mock.Anything, matchCreate("child", "Child", "generated"), "").
			Return(&folder.Folder{UID: "child", Title: "Child", ParentUID: "generated", OrgID: 1}, nil).Once()

		uid, err := prov.resolveFolder(ctx, groupWithFolder("Parent/Child", "child"))
		require.NoError(t, err)
		require.Equal(t, "child", uid)
	})

	t.Run("errors when the uid does not exist and no title is set", func(t *testing.T) {
		prov, _ := newTestRuleProvisioner(t)

		_, err := prov.resolveFolder(ctx, groupWithFolder("", "missing"))
		require.ErrorContains(t, err, "missing")
	})

	t.Run("rejects the general folder uid", func(t *testing.T) {
		prov, _ := newTestRuleProvisioner(t)

		_, err := prov.resolveFolder(ctx, groupWithFolder("General", "general"))
		require.ErrorIs(t, err, folder.ErrInvalidUID)
	})

	t.Run("falls back to the title lookup when no uid is set", func(t *testing.T) {
		prov, _ := newTestRuleProvisioner(t, &folder.Folder{UID: "by-title", Title: "Test", OrgID: 1})

		uid, err := prov.resolveFolder(ctx, groupWithFolder("Test", ""))
		require.NoError(t, err)
		require.Equal(t, "by-title", uid)
	})
}

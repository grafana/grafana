package folderscope

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_OrgScopedResourceGetsNoFolderAnnotation verifies that
// whether a synced resource receives a grafana.app/folder annotation is purely a function
// of the [provisioning] resources configuration. This package declares dashboards WITHOUT
// the folder capability, so a dashboard synced from a subdirectory must NOT have a
// (meaningless, possibly dangling) folder annotation stamped onto it.
//
// The complementary positive case — a folder-capable kind getting the annotation — is the
// default and is covered by the foldermetadata suite and the parser unit tests.
func TestIntegrationProvisioning_OrgScopedResourceGetsNoFolderAnnotation(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo       = "folder-guard-org-scoped"
		sourcePath = "team-a/dashboard.json"
	)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Copies: map[string]string{
			"../testdata/all-panels.json": sourcePath,
		},
		SkipResourceAssertions: true,
	})

	// An empty expected folder UID asserts the dashboard carries no folder annotation.
	common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repo, sourcePath, "")
}

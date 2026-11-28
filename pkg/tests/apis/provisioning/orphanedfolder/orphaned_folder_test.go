package orphanedfolder

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	db.SetupTestDB()
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}

// With the async cascade on, a folder carries the cascade finalizer. Once its repository is gone,
// storage only lets the write that marks it terminating through, so a delete must not need any other
// write, such as recording the requester, to succeed first.
func TestIntegrationProvisioning_AsyncCascadeDeletesOrphanedManagedFolders(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
		opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagFolderAsyncCascadeDeleteThroughController)
	})

	const repo = "orphaned-async"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies:     map[string]string{"../testdata/text-options.json": "nested/dashboard.json"},
	})

	var nestedFolder string
	for _, f := range helper.RequireRepoFolderCount(t, repo, 2) {
		require.Contains(t, f.GetFinalizers(), foldersv1.CascadeDeleteFinalizer, "folder %s should carry the cascade finalizer", f.GetName())
		if f.GetName() != repo {
			nestedFolder = f.GetName()
		}
	}
	require.NotEmpty(t, nestedFolder)

	// Keep only the cleanup finalizer, so the repository goes away and its folders stay.
	patch := fmt.Appendf(nil, `[{"op":"replace","path":"/metadata/finalizers","value":[%q]}]`, repository.CleanFinalizer)
	_, err := helper.Repositories.Resource.Patch(t.Context(), repo, types.JSONPatchType, patch, metav1.PatchOptions{})
	require.NoError(t, err)
	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, repo)

	forceDelete := metav1.DeleteOptions{GracePeriodSeconds: new(int64)}
	for name, folder := range map[string]string{"an orphaned nested folder": nestedFolder, "an orphaned root folder": repo} {
		t.Run(name+" can be deleted", func(t *testing.T) {
			require.NoError(t, helper.Folders.Resource.Delete(t.Context(), folder, forceDelete))

			// Without a controller running the folder stays terminating; either way the delete started.
			got, err := helper.Folders.Resource.Get(t.Context(), folder, metav1.GetOptions{})
			if !apierrors.IsNotFound(err) {
				require.NoError(t, err)
				require.NotNil(t, got.GetDeletionTimestamp(), "the folder should be terminating")
			}
		})
	}
}

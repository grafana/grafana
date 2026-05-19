package quota

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_RepositoryLimits(t *testing.T) {
	helper := sharedHelper(t)
	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 10})
	ctx := context.Background()

	originalName := "original-repo"
	originalRepo := common.TestRepo{
		Name:               originalName,
		SyncTarget:         "instance",
		Copies:             map[string]string{},
		ExpectedDashboards: 0,
		ExpectedFolders:    0,
	}
	helper.CreateLocalRepo(t, originalRepo)

	t.Run("folder sync is rejected when instance sync exists", func(t *testing.T) {
		folderRepo := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), map[string]any{
			"Name":          "folder-blocked-by-instance",
			"SyncEnabled":   true,
			"SyncTarget":    "folder",
			"Path":          helper.ProvisioningPath,
			"WorkflowsJSON": `["write"]`,
		})

		_, err := helper.Repositories.Resource.Create(ctx, folderRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "folder sync repository should be rejected when instance sync exists")

		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Cannot create folder repository when instance repository exists: "+originalName)
	})

	t.Run("change between folder and instance sync for the same repository if no previous sync happened", func(t *testing.T) {
		repo, err := helper.Repositories.Resource.Get(ctx, originalName, metav1.GetOptions{})
		require.NoError(t, err, "failed to get repository")
		err = unstructured.SetNestedField(repo.Object, "folder", "spec", "sync", "target")
		require.NoError(t, err, "failed to set syncTarget to folder")
		_, err = helper.Repositories.Resource.Update(ctx, repo, metav1.UpdateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to update repository to folder sync")

		require.Eventually(t, func() bool {
			repos, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
			if err != nil {
				return false
			}

			for _, repo := range repos.Items {
				if repo.GetName() == originalName {
					syncTarget, found, err := unstructured.NestedString(repo.Object, "spec", "sync", "target")
					if err != nil || !found {
						return false
					}

					return syncTarget == "folder"
				}
			}

			return false
		}, time.Second*10, time.Millisecond*100, "failed to verify that sync target is folder")
	})

	t.Run("instance sync rejected when any other repository exists", func(t *testing.T) {
		instanceRepo := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), map[string]any{
			"Name":          "instance-repo-blocked",
			"SyncEnabled":   true,
			"SyncTarget":    "instance",
			"Path":          helper.ProvisioningPath,
			"WorkflowsJSON": `["write"]`,
		})

		_, err := helper.Repositories.Resource.Create(ctx, instanceRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "instance sync repository should be rejected when any other repository exists")

		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Instance repository can only be created when no other repositories exist. Found: "+originalName)
	})

	t.Run("repository limit validation of 10 for folder syncs repositories", func(t *testing.T) {
		require.Eventually(t, func() bool {
			repo, err := helper.Repositories.Resource.Get(ctx, originalName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			syncTarget, found, err := unstructured.NestedString(repo.Object, "spec", "sync", "target")
			if err != nil || !found {
				return false
			}
			return syncTarget == "folder"
		}, time.Second*10, time.Millisecond*100, "original repo should be folder sync")

		existingRepos, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list repositories")
		existingCount := len(existingRepos.Items)
		require.Equal(t, 1, existingCount, "should have 1 existing repository (original-repo)")

		for i := 2; i <= 10; i++ {
			repoName := fmt.Sprintf("limit-test-repo-%d", i)
			limitTestRepo := common.TestRepo{
				Name:               repoName,
				SyncTarget:         "folder",
				Copies:             map[string]string{},
				ExpectedDashboards: 0,
				ExpectedFolders:    i,
			}
			helper.CreateLocalRepo(t, limitTestRepo)
		}

		eleventhRepoName := "limit-test-repo-11"
		eleventhRepo := helper.RenderObject(t, common.TestdataPath("local.json.tmpl"), map[string]any{
			"Name":          eleventhRepoName,
			"SyncEnabled":   true,
			"SyncTarget":    "folder",
			"Path":          helper.ProvisioningPath,
			"WorkflowsJSON": `["write"]`,
		})

		_, createErr := helper.Repositories.Resource.Create(ctx, eleventhRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, createErr, "11th repository should be rejected due to limit")

		statusError := helper.RequireApiErrorStatus(createErr, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Maximum number of 10 repositories reached")
	})
}

package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_RepositoryFieldSelector tests that fieldSelector
// works correctly for Repository resources. This prevents regression where
// fieldSelector=metadata.name=<name> was not working properly.
func TestIntegrationProvisioning_RepositoryFieldSelector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Create multiple repositories for testing
	repo1Name := "repo-selector-test-1"
	repo2Name := "repo-selector-test-2"
	repo3Name := "repo-selector-test-3"

	// Create first repository
	repo1 := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo1Name,
		"SyncEnabled": false, // Disable sync to speed up test
	})
	_, err := helper.Repositories.Resource.Create(ctx, repo1, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create first repository")
	helper.WaitForHealthyRepository(t, repo1Name)

	// Create second repository
	repo2 := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo2Name,
		"SyncEnabled": false,
	})
	_, err = helper.Repositories.Resource.Create(ctx, repo2, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create second repository")
	helper.WaitForHealthyRepository(t, repo2Name)

	// Create third repository
	repo3 := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo3Name,
		"SyncEnabled": false,
	})
	_, err = helper.Repositories.Resource.Create(ctx, repo3, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create third repository")
	helper.WaitForHealthyRepository(t, repo3Name)

	// Verify all repositories were created
	allRepos, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "should be able to list all repositories")
	require.GreaterOrEqual(t, len(allRepos.Items), 3, "should have at least 3 repositories")

	t.Run("should filter by metadata.name and return single repository", func(t *testing.T) {
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=" + repo2Name,
		})
		require.NoError(t, err, "fieldSelector query should succeed")
		require.Len(t, list.Items, 1, "should return exactly one repository")
		require.Equal(t, repo2Name, list.Items[0].GetName(), "should return the correct repository")
	})

	t.Run("should filter by different metadata.name", func(t *testing.T) {
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=" + repo1Name,
		})
		require.NoError(t, err, "fieldSelector query should succeed")
		require.Len(t, list.Items, 1, "should return exactly one repository")
		require.Equal(t, repo1Name, list.Items[0].GetName(), "should return the first repository")
	})

	t.Run("should return empty when fieldSelector does not match any repository", func(t *testing.T) {
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=non-existent-repository",
		})
		require.NoError(t, err, "fieldSelector query should succeed even with no matches")
		require.Empty(t, list.Items, "should return empty list when no repositories match")
	})

	t.Run("listing without fieldSelector should return all repositories", func(t *testing.T) {
		list, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should be able to list without fieldSelector")
		require.GreaterOrEqual(t, len(list.Items), 3, "should return all repositories when no filter is applied")

		// Verify our test repositories are in the list
		names := make(map[string]bool)
		for _, item := range list.Items {
			names[item.GetName()] = true
		}
		require.True(t, names[repo1Name], "should contain repo1")
		require.True(t, names[repo2Name], "should contain repo2")
		require.True(t, names[repo3Name], "should contain repo3")
	})
}

// TestIntegrationProvisioning_JobFieldSelector tests that fieldSelector
// works correctly for Job resources. This prevents regression where
// fieldSelector=metadata.name=<name> was not working properly.
func TestIntegrationProvisioning_JobFieldSelector(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Create a repository to trigger jobs
	repoName := "job-selector-test-repo"
	repo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repoName,
		"SyncEnabled": false,
	})
	_, err := helper.Repositories.Resource.Create(ctx, repo, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create repository")
	helper.WaitForHealthyRepository(t, repoName)

	// Copy some test files to trigger jobs
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "job-test-dashboard-1.json")
	helper.CopyToProvisioningPath(t, "testdata/text-options.json", "job-test-dashboard-2.json")

	// Trigger multiple jobs to have multiple job resources
	job1Spec := provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	}

	// Trigger first job
	body1 := asJSON(job1Spec)
	result1 := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(body1).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result1.Error(), "should be able to trigger first job")

	obj1, err := result1.Get()
	require.NoError(t, err, "should get first job object")
	job1 := obj1.(*unstructured.Unstructured)
	job1Name := job1.GetName()
	require.NotEmpty(t, job1Name, "first job should have a name")

	// Wait for first job to complete before starting second
	helper.AwaitJobs(t, repoName)

	// Trigger second job
	result2 := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(body1).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result2.Error(), "should be able to trigger second job")

	obj2, err := result2.Get()
	require.NoError(t, err, "should get second job object")
	job2 := obj2.(*unstructured.Unstructured)
	job2Name := job2.GetName()
	require.NotEmpty(t, job2Name, "second job should have a name")

	t.Run("should filter by metadata.name and return single job", func(t *testing.T) {
		// Note: Jobs are ephemeral and may complete quickly, so we test while they exist
		list, err := helper.Jobs.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=" + job2Name,
		})
		require.NoError(t, err, "fieldSelector query should succeed")

		// The job might have completed already, but if it exists, it should be the only one
		if len(list.Items) > 0 {
			require.Len(t, list.Items, 1, "should return at most one job")
			require.Equal(t, job2Name, list.Items[0].GetName(), "should return the correct job")
		}
	})

	t.Run("should filter by different metadata.name", func(t *testing.T) {
		list, err := helper.Jobs.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=" + job1Name,
		})
		require.NoError(t, err, "fieldSelector query should succeed")

		// The job might have completed already, but if it exists, it should be the only one
		if len(list.Items) > 0 {
			require.Len(t, list.Items, 1, "should return at most one job")
			require.Equal(t, job1Name, list.Items[0].GetName(), "should return the first job")
		}
	})

	t.Run("should return empty when fieldSelector does not match any job", func(t *testing.T) {
		list, err := helper.Jobs.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=non-existent-job",
		})
		require.NoError(t, err, "fieldSelector query should succeed even with no matches")
		require.Empty(t, list.Items, "should return empty list when no jobs match")
	})

	t.Run("listing without fieldSelector should work", func(t *testing.T) {
		list, err := helper.Jobs.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should be able to list without fieldSelector")
		// Jobs may have completed, so we don't assert on count, just that the query works
		t.Logf("Found %d active jobs without filter", len(list.Items))
	})
}

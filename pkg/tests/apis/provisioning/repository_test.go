package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/tests/apis"
)

func TestIntegrationProvisioning_CreatingAndGetting(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	ctx := context.Background()

	inputFiles := []string{
		"testdata/github-readonly.json.tmpl",
		"testdata/local-readonly.json.tmpl",
	}

	for _, inputFilePath := range inputFiles {
		t.Run(inputFilePath, func(t *testing.T) {
			input := helper.RenderObject(t, inputFilePath, nil)
			name := mustNestedString(input.Object, "metadata", "name")

			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			output, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "failed to read back resource")

			// Move encrypted token mutation
			token, found, err := unstructured.NestedString(output.Object, "spec", "github", "encryptedToken")
			require.NoError(t, err, "encryptedToken is not a string")
			if found {
				unstructured.RemoveNestedField(input.Object, "spec", "github", "token")
				err = unstructured.SetNestedField(input.Object, token, "spec", "github", "encryptedToken")
				require.NoError(t, err, "unable to copy encrypted token")
			}

			// Marshal as real objects to ",omitempty" values are tested properly
			expectedRepo := unstructuredToRepository(t, input)
			returnedRepo := unstructuredToRepository(t, output)
			require.Equal(t, expectedRepo.Spec, returnedRepo.Spec)

			// A viewer should not be able to see the same thing
			var statusCode int
			rsp := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Do(context.Background())
			require.Error(t, rsp.Error())
			rsp.StatusCode(&statusCode)
			require.Equal(t, http.StatusForbidden, statusCode)

			// Viewer can see file listing
			rsp = helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Suffix("files/").
				Do(context.Background())
			require.NoError(t, rsp.Error())

			// Verify that we can list refs
			rsp = helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Suffix("refs").
				Do(context.Background())

			if expectedRepo.Spec.Type == provisioning.LocalRepositoryType {
				require.ErrorContains(t, rsp.Error(), "does not support versioned operations")
			} else {
				require.NoError(t, rsp.Error())
				refs := &provisioning.RefList{}
				err = rsp.Into(refs)
				require.NoError(t, err)
				require.True(t, len(refs.Items) >= 1, "should have at least one ref")

				var foundBranch bool
				for _, ref := range refs.Items {
					// FIXME: this assertion should be improved for all git types and take things from config
					if ref.Name == "integration-test" {
						require.Equal(t, "0f3370c212b04b9704e00f6926ef339bf91c7a1b", ref.Hash)
						require.Equal(t, "https://github.com/grafana/grafana-git-sync-demo/tree/integration-test", ref.RefURL)
						foundBranch = true
					}
				}

				require.True(t, foundBranch, "branch should be found")
			}
		})
	}

	// Viewer can see settings listing
	t.Run("viewer has access to list", func(t *testing.T) {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			settings := &provisioning.RepositoryViewList{}
			rsp := helper.ViewerREST.Get().
				Namespace("default").
				Suffix("settings").
				Do(context.Background())
			if !assert.NoError(collect, rsp.Error()) {
				return
			}

			err := rsp.Into(settings)
			if !assert.NoError(collect, err) {
				return
			}
			if !assert.Len(collect, settings.Items, len(inputFiles)) {
				return
			}

			// FIXME: this should be an enterprise integration test
			if extensions.IsEnterprise {
				assert.ElementsMatch(collect, []provisioning.RepositoryType{
					provisioning.LocalRepositoryType,
					provisioning.GitHubRepositoryType,
					provisioning.GitRepositoryType,
					provisioning.BitbucketRepositoryType,
					provisioning.GitLabRepositoryType,
				}, settings.AvailableRepositoryTypes)
			} else {
				assert.ElementsMatch(collect, []provisioning.RepositoryType{
					provisioning.LocalRepositoryType,
					provisioning.GitHubRepositoryType,
				}, settings.AvailableRepositoryTypes)
			}
		}, time.Second*10, time.Millisecond*100, "Expected settings to match")
	})

	t.Run("Repositories are reported in stats", func(t *testing.T) {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			report := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
				Method: http.MethodGet,
				Path:   "/api/admin/usage-report-preview",
				User:   helper.Org1.Admin,
			}, &usagestats.Report{})

			stats := map[string]any{}
			for k, v := range report.Result.Metrics {
				if strings.HasPrefix(k, "stats.repository.") {
					stats[k] = v
				}
			}
			assert.Equal(collect, map[string]any{
				"stats.repository.github.count": 1.0,
				"stats.repository.local.count":  1.0,
			}, stats)
		}, time.Second*10, time.Millisecond*100, "Expected stats to match")
	})
}

func TestIntegrationProvisioning_FailInvalidSchema(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Skip("Reenable this test once we enforce schema validation for provisioning")

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "invalid-schema-tmp"
	// Set up the repository and the file to import.
	helper.CopyToProvisioningPath(t, "testdata/invalid-dashboard-schema.json", "invalid-dashboard-schema.json")

	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Make sure the repo can read and validate the file
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "invalid-dashboard-schema.json")
	status := helper.RequireApiErrorStatus(err, metav1.StatusReasonBadRequest, http.StatusBadRequest)
	require.Equal(t, status.Message, "Dry run failed: Dashboard.dashboard.grafana.app \"invalid-schema-uid\" is invalid: [spec.panels.0.repeatDirection: Invalid value: conflicting values \"h\" and \"this is not an allowed value\", spec.panels.0.repeatDirection: Invalid value: conflicting values \"v\" and \"this is not an allowed value\"]")

	const invalidSchemaUid = "invalid-schema-uid"
	_, err = helper.DashboardsV1.Resource.Get(ctx, invalidSchemaUid, metav1.GetOptions{})
	require.Error(t, err, "invalid dashboard shouldn't exist")
	require.True(t, apierrors.IsNotFound(err))

	helper.DebugState(t, repo, "BEFORE PULL JOB WITH INVALID SCHEMA")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	}

	result := helper.TriggerJobAndWaitForComplete(t, repo, spec)
	job := &provisioning.Job{}
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, job)
	require.NoError(t, err, "should convert to Job object")

	assert.Equal(t, provisioning.JobStateError, job.Status.State)
	assert.Equal(t, job.Status.Message, "completed with errors")
	assert.Equal(t, job.Status.Errors[0], "Dashboard.dashboard.grafana.app \"invalid-schema-uid\" is invalid: [spec.panels.0.repeatDirection: Invalid value: conflicting values \"h\" and \"this is not an allowed value\", spec.panels.0.repeatDirection: Invalid value: conflicting values \"v\" and \"this is not an allowed value\"]")

	_, err = helper.DashboardsV1.Resource.Get(ctx, invalidSchemaUid, metav1.GetOptions{})
	require.Error(t, err, "invalid dashboard shouldn't have been created")
	require.True(t, apierrors.IsNotFound(err))

	err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{}, "files", "invalid-dashboard-schema.json")
	require.NoError(t, err, "should delete the resource file")
}

func TestIntegrationProvisioning_CreatingGitHubRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// FIXME: instead of using an existing GitHub repository, we should create a new one for the tests and a branch
	// This was the previous structure
	// ghmock.WithRequestMatchHandler(ghmock.GetReposGitTreesByOwnerByRepoByTreeSha,
	// 	ghHandleTree(t, map[string][]*gh.TreeEntry{
	// 		"deadbeef": {
	// 			treeEntryDir("grafana", "subtree"),
	// 		},
	// 		"subtree": {
	// 			treeEntry("dashboard.json", helper.LoadFile("testdata/all-panels.json")),
	// 			treeEntryDir("subdir", "subtree2"),
	// 			treeEntry("subdir/dashboard2.yaml", helper.LoadFile("testdata/text-options.json")),
	// 		},
	// 	})),

	// FIXME: uncomment these to implement webhook integration tests.
	// helper.GetEnv().GitHubFactory.Client = ghmock.NewMockedHTTPClient(
	// 	ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepo, ghAlwaysWrite(t, []*gh.Hook{})),
	// 	ghmock.WithRequestMatchHandler(ghmock.PostReposHooksByOwnerByRepo, ghAlwaysWrite(t, &gh.Hook{ID: gh.Ptr(int64(123))})),
	// )

	const repo = "github-create-test"
	testRepo := TestRepo{
		Name:               repo,
		Template:           "testdata/github-readonly.json.tmpl",
		Target:             "instance",
		ExpectedDashboards: 3,
		ExpectedFolders:    2,
	}

	helper.CreateRepo(t, testRepo)

	// By now, we should have synced, meaning we have data to read in the local Grafana instance!

	found, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	require.Len(t, names, 3, "should have three dashboards")
	assert.Contains(t, names, "adg5vbj", "should contain dashboard.json's contents")
	assert.Contains(t, names, "admfz74", "should contain dashboard2.yaml's contents")
	assert.Contains(t, names, "adn5mxb", "should contain dashboard2.yaml's contents")

	err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
	require.NoError(t, err, "should delete values")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		found, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		assert.NoError(t, err, "can list values")
		assert.Equal(collect, 0, len(found.Items), "expected dashboards to be deleted")
	}, time.Second*20, time.Millisecond*10, "Expected dashboards to be deleted")

	// Wait for repository to be fully deleted before subtests run
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "repository should be deleted")
	}, time.Second*10, time.Millisecond*50, "repository should be deleted before subtests")

	t.Run("github url cleanup", func(t *testing.T) {
		tests := []struct {
			name   string
			input  string
			output string
		}{
			{
				name:   "simple-url",
				input:  "https://github.com/dprokop/grafana-git-sync-test",
				output: "https://github.com/dprokop/grafana-git-sync-test",
			},
			{
				name:   "trim-dot-git",
				input:  "https://github.com/dprokop/grafana-git-sync-test.git",
				output: "https://github.com/dprokop/grafana-git-sync-test",
			},
			{
				name:   "trim-slash",
				input:  "https://github.com/dprokop/grafana-git-sync-test/",
				output: "https://github.com/dprokop/grafana-git-sync-test",
			},
		}

		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				input := helper.RenderObject(t, "testdata/github-readonly.json.tmpl", map[string]any{
					"Name":        test.name,
					"URL":         test.input,
					"SyncTarget":  "folder",
					"SyncEnabled": false, // Disable sync since we're just testing URL cleanup
				})

				_, err = helper.Repositories.Resource.Create(ctx, input, metav1.CreateOptions{})
				require.NoError(t, err, "failed to create resource")

				obj, err := helper.Repositories.Resource.Get(ctx, test.name, metav1.GetOptions{})
				require.NoError(t, err, "failed to read back resource")

				url, _, err := unstructured.NestedString(obj.Object, "spec", "github", "url")
				require.NoError(t, err, "failed to read URL")
				require.Equal(t, test.output, url)

				err = helper.Repositories.Resource.Delete(ctx, test.name, metav1.DeleteOptions{})
				require.NoError(t, err, "failed to delete")

				// Wait for repository to be fully deleted before next test
				require.EventuallyWithT(t, func(collect *assert.CollectT) {
					_, err := helper.Repositories.Resource.Get(ctx, test.name, metav1.GetOptions{})
					assert.True(collect, apierrors.IsNotFound(err), "repository should be deleted")
				}, time.Second*5, time.Millisecond*50, "repository should be deleted")
			})
		}
	})
}

func TestIntegrationProvisioning_InstanceSyncValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	t.Run("single instance sync is allowed", func(t *testing.T) {
		repoName := "instance-repo-single"
		testRepo := TestRepo{
			Name:               repoName,
			Target:             "instance",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    0,
		}

		// Create instance sync repository - should succeed
		helper.CreateRepo(t, testRepo)

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})

	t.Run("change between folder and instance sync for the same repository if no previous sync happened", func(t *testing.T) {
		// Ensure clean state
		helper.CleanupAllRepos(t)

		repoName := "instance-repo-change"
		testRepo := TestRepo{
			Name:               repoName,
			Target:             "instance",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    0,
			SkipSync:           true, // To avoid initial sync and stats
		}
		helper.CreateRepo(t, testRepo)

		// Change from instance to folder sync
		repo, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err, "failed to get repository")
		err = unstructured.SetNestedField(repo.Object, "folder", "spec", "sync", "target")
		require.NoError(t, err, "failed to set syncTarget to folder")
		_, err = helper.Repositories.Resource.Update(ctx, repo, metav1.UpdateOptions{FieldValidation: "Strict"})
		require.NoError(t, err, "failed to update repository to folder sync")

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})

	t.Run("instance sync rejected when any other repository exists", func(t *testing.T) {
		// Ensure clean state
		helper.CleanupAllRepos(t)

		existingFolderName := "existing-folder-repo"
		instanceRepoName := "instance-repo-blocked"

		// Create a folder sync repository first
		folderTestRepo := TestRepo{
			Name:               existingFolderName,
			Target:             "folder",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    1, // One folder expected after sync
		}
		helper.CreateRepo(t, folderTestRepo)

		// Try to create an instance sync repository - should fail because any other repository exists
		instanceRepo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        instanceRepoName,
			"SyncEnabled": true,
			"SyncTarget":  "instance",
		})

		_, err := helper.Repositories.Resource.Create(ctx, instanceRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "instance sync repository should be rejected when any other repository exists")

		// Verify the error message mentions that instance can only be created when no other repositories exist
		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Instance repository can only be created when no other repositories exist. Found: "+existingFolderName)

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})

	t.Run("multiple folder syncs are allowed", func(t *testing.T) {
		// Ensure clean state
		helper.CleanupAllRepos(t)

		firstFolderName := "folder-repo-multi-1"
		secondFolderName := "folder-repo-multi-2"

		// Create first folder sync repository
		folderTestRepo1 := TestRepo{
			Name:               firstFolderName,
			Target:             "folder",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    1, // One folder expected after sync
		}
		helper.CreateRepo(t, folderTestRepo1)

		// Create second folder sync repository - should succeed
		folderTestRepo2 := TestRepo{
			Name:               secondFolderName,
			Target:             "folder",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    2, // Two folders expected after sync (1 + 1)
		}
		helper.CreateRepo(t, folderTestRepo2)

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})

	t.Run("folder sync is rejected when instance sync exists", func(t *testing.T) {
		// Ensure clean state
		helper.CleanupAllRepos(t)

		instanceRepoName := "instance-blocking-folder"
		folderRepoName := "folder-blocked-by-instance"

		// Create instance sync repository first
		instanceTestRepo := TestRepo{
			Name:               instanceRepoName,
			Target:             "instance",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    0,
		}
		helper.CreateRepo(t, instanceTestRepo)

		// Try to create folder sync repository - should fail
		folderRepo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        folderRepoName,
			"SyncEnabled": true,
			"SyncTarget":  "folder",
		})

		_, err := helper.Repositories.Resource.Create(ctx, folderRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "folder sync repository should be rejected when instance sync exists")

		// Verify the error message mentions the existing instance repository
		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Cannot create folder repository when instance repository exists: "+instanceRepoName)

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})

	t.Run("instance sync can only be created when no repositories exist", func(t *testing.T) {
		// Ensure clean state
		helper.CleanupAllRepos(t)

		// This test verifies that instance sync can ONLY be created when there are no other repositories
		instanceRepoName := "instance-only-when-empty"

		// First, create instance sync repository when no other repositories exist - should succeed
		instanceTestRepo := TestRepo{
			Name:               instanceRepoName,
			Target:             "instance",
			Copies:             map[string]string{}, // No files needed for this test
			ExpectedDashboards: 0,
			ExpectedFolders:    0,
		}
		helper.CreateRepo(t, instanceTestRepo)

		// Now try to create any other repository - should fail
		otherRepoName := "other-repo-blocked"
		otherRepo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        otherRepoName,
			"SyncEnabled": true,
			"SyncTarget":  "folder",
		})

		_, err := helper.Repositories.Resource.Create(ctx, otherRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "folder sync repository should be rejected when instance sync exists")

		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Cannot create folder repository when instance repository exists: "+instanceRepoName)

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})

	t.Run("repository limit validation", func(t *testing.T) {
		// Ensure clean state
		helper.CleanupAllRepos(t)

		// This test verifies the 10 repository limit validation by actually creating 10 repositories

		// Create 10 repositories - should all succeed
		for i := 1; i <= 10; i++ {
			repoName := fmt.Sprintf("limit-test-repo-%d", i)
			limitTestRepo := TestRepo{
				Name:               repoName,
				Target:             "folder",
				Copies:             map[string]string{}, // No files needed for this test
				ExpectedDashboards: 0,
				ExpectedFolders:    i, // Each repository creates a folder, so total = i
			}
			helper.CreateRepo(t, limitTestRepo)
		}

		// Try to create the 11th repository - should fail due to limit
		eleventhRepoName := "limit-test-repo-11"
		eleventhRepo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        eleventhRepoName,
			"SyncEnabled": true,
			"SyncTarget":  "folder",
		})

		_, err := helper.Repositories.Resource.Create(ctx, eleventhRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "11th repository should be rejected due to limit")

		// Verify the error message mentions the repository limit
		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Maximum number of 10 repositories reached")

		// Clean up at end of test
		helper.CleanupAllRepos(t)
	})
}

func TestIntegrationProvisioning_RunLocalRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const allPanels = "n1jR8vnnz"
	const repo = "local-local-examples"
	const targetPath = "all-panels.json"

	// Set up the repository.
	helper.CreateRepo(t, TestRepo{Name: repo})

	// Write a file -- this will create it *both* in the local file system, and in grafana
	t.Run("write all panels", func(t *testing.T) {
		code := 0

		// Check that we can not (yet) UPDATE the target path
		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", targetPath).
			Body(helper.LoadFile("testdata/all-panels.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&code)
		require.Equal(t, http.StatusNotFound, code)
		require.True(t, apierrors.IsNotFound(result.Error()))

		// Now try again with POST (as an editor)
		result = helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", targetPath).
			Body(helper.LoadFile("testdata/all-panels.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&code)
		require.NoError(t, result.Error(), "expecting to be able to create file")
		wrapper := &provisioning.ResourceWrapper{}
		raw, err := result.Raw()
		require.NoError(t, err)
		err = json.Unmarshal(raw, wrapper)
		require.NoError(t, err)
		require.Equal(t, 200, code, "expected 200 response")
		require.Equal(t, provisioning.ClassicDashboard, wrapper.Resource.Type.Classic)
		name, _, _ := unstructured.NestedString(wrapper.Resource.File.Object, "metadata", "name")
		require.Equal(t, allPanels, name, "name from classic UID")
		name, _, _ = unstructured.NestedString(wrapper.Resource.Upsert.Object, "metadata", "name")
		require.Equal(t, allPanels, name, "save the name from the request")

		// Get the file from the grafana database
		obj, err := helper.DashboardsV1.Resource.Get(ctx, allPanels, metav1.GetOptions{})
		require.NoError(t, err, "the value should be saved in grafana")
		val, _, _ := unstructured.NestedString(obj.Object, "metadata", "annotations", utils.AnnoKeyManagerKind)
		require.Equal(t, string(utils.ManagerKindRepo), val, "should have repo annotations")
		val, _, _ = unstructured.NestedString(obj.Object, "metadata", "annotations", utils.AnnoKeyManagerIdentity)
		require.Equal(t, repo, val, "should have repo annotations")

		// Read the file we wrote
		wrapObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", targetPath)
		require.NoError(t, err, "read value")

		wrap := &unstructured.Unstructured{}
		wrap.Object, _, err = unstructured.NestedMap(wrapObj.Object, "resource", "dryRun")
		require.NoError(t, err)
		meta, err := utils.MetaAccessor(wrap)
		require.NoError(t, err)
		require.Equal(t, allPanels, meta.GetName(), "read the name out of the saved file")

		// Check that an admin can update
		meta.SetAnnotation("test", "from-provisioning")
		body, err := json.Marshal(wrap.Object)
		require.NoError(t, err)
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", targetPath).
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&code)
		require.Equal(t, 200, code)
		require.NoError(t, result.Error(), "update as admin value")
		raw, err = result.Raw()
		require.NoError(t, err)
		err = json.Unmarshal(raw, wrapper)
		require.NoError(t, err)
		anno, _, _ := unstructured.NestedString(wrapper.Resource.File.Object, "metadata", "annotations", "test")
		require.Equal(t, "from-provisioning", anno, "should set the annotation")

		// But a viewer can not
		result = helper.ViewerREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", targetPath).
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&code)
		require.Equal(t, 403, code)
		require.True(t, apierrors.IsForbidden(result.Error()), code)
	})

	t.Run("fail using invalid paths", func(t *testing.T) {
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "test", "..", "..", "all-panels.json"). // UNSAFE PATH
			Body(helper.LoadFile("testdata/all-panels.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.Error(t, result.Error(), "invalid path should return error")

		// Read a file with a bad path
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "../../all-panels.json")
		require.Error(t, err, "invalid path should error")
	})

	t.Run("require name or generateName", func(t *testing.T) {
		code := 0
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "example.json").
			Body([]byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
spec:
  title: Test dashboard
`)).Do(ctx).StatusCode(&code)
		require.Error(t, result.Error(), "missing name")

		result = helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "example.json").
			Body([]byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  generateName: prefix-
spec:
  title: Test dashboard
`)).Do(ctx).StatusCode(&code)
		require.NoError(t, result.Error(), "should create name")
		require.Equal(t, 200, code, "expect OK result")

		raw, err := result.Raw()
		require.NoError(t, err)

		obj := &unstructured.Unstructured{}
		err = json.Unmarshal(raw, obj)
		require.NoError(t, err)

		name, _, _ := unstructured.NestedString(obj.Object, "resource", "upsert", "metadata", "name")
		require.True(t, strings.HasPrefix(name, "prefix-"), "should generate name")
	})
}

func TestIntegrationProvisioning_ImportAllPanelsFromLocalRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// The dashboard shouldn't exist yet
	const allPanels = "n1jR8vnnz"
	_, err := helper.DashboardsV1.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "no all-panels dashboard should exist")
	require.True(t, apierrors.IsNotFound(err))

	const repo = "local-tmp"
	// Set up the repository and the file to import.
	testRepo := TestRepo{
		Name:               repo,
		Target:             "instance",
		Copies:             map[string]string{"testdata/all-panels.json": "all-panels.json"},
		ExpectedDashboards: 1,
		ExpectedFolders:    0,
	}
	// We create the repository
	helper.CreateRepo(t, testRepo)

	// Now, we import it, such that it may exist
	// The sync may not be necessary as the sync may have happened automatically at this point
	helper.SyncAndWait(t, repo, nil)

	// Make sure the repo can read and validate the file
	obj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	resource, _, err := unstructured.NestedMap(obj.Object, "resource")
	require.NoError(t, err, "missing resource")
	require.NoError(t, err, "invalid action")
	require.NotNil(t, resource["file"], "the raw file")
	require.NotNil(t, resource["dryRun"], "dryRun result")

	action, _, err := unstructured.NestedString(resource, "action")
	require.NoError(t, err, "invalid action")
	// FIXME: there is no point in in returning action for a read / get request.
	require.Equal(t, "update", action)

	_, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	obj, err = helper.DashboardsV1.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.NoError(t, err, "all-panels dashboard should exist")
	require.Equal(t, repo, obj.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	// Try writing the value directly
	err = unstructured.SetNestedField(obj.Object, []any{"aaa", "bbb"}, "spec", "tags")
	require.NoError(t, err, "set tags")
	obj, err = helper.DashboardsV1.Resource.Update(ctx, obj, metav1.UpdateOptions{})
	require.NoError(t, err)
	v, _, _ := unstructured.NestedString(obj.Object, "metadata", "annotations", utils.AnnoKeyUpdatedBy)
	require.Equal(t, "access-policy:provisioning", v)

	// Should not be able to directly delete the managed resource
	err = helper.DashboardsV1.Resource.Delete(ctx, allPanels, metav1.DeleteOptions{})
	require.NoError(t, err, "user can delete")

	_, err = helper.DashboardsV1.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "should delete the internal resource")
	require.True(t, apierrors.IsNotFound(err))
}

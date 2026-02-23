package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	provisioningAPIServer "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_CreatingAndGetting(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			token, found, err := unstructured.NestedString(output.Object, "secure", "token", "name")
			require.NoError(t, err, "secure token name is not a string")
			if found {
				require.True(t, strings.HasPrefix("inline-", token)) // name created automatically
				err = unstructured.SetNestedField(input.Object, token, "secure", "token", "name")
				require.NoError(t, err, "unable to copy secure token")
			}

			// Marshal as real objects to ",omitempty" values are tested properly
			expectedRepo := unstructuredToRepository(t, input)
			returnedRepo := unstructuredToRepository(t, output)
			require.Equal(t, expectedRepo.Spec, returnedRepo.Spec)

			// A viewer should be able to read the repository
			var statusCode int
			rsp := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Do(context.Background())
			require.NoError(t, rsp.Error(), "viewer should be able to read repository")
			rsp.StatusCode(&statusCode)
			require.Equal(t, http.StatusOK, statusCode)

			viewerOutput, err := rsp.Get()
			require.NoError(t, err, "should get repository object")
			viewerUnstruct, ok := viewerOutput.(*unstructured.Unstructured)
			require.True(t, ok, "expecting unstructured object")

			// Verify viewer gets the same repository data
			viewerRepo := unstructuredToRepository(t, viewerUnstruct)
			require.Equal(t, expectedRepo.Spec, viewerRepo.Spec, "viewer should see same repository spec")

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

			for _, i := range settings.Items {
				switch i.Type {
				case provisioning.LocalRepositoryType:
					assert.Equal(collect, i.Path, helper.ProvisioningPath)
				case provisioning.GitHubRepositoryType:
					assert.Equal(collect, i.URL, "https://github.com/grafana/grafana-git-sync-demo")
					assert.Equal(collect, i.Path, "grafana/")
				default:
					assert.NotEmpty(collect, i.Path)
					assert.NotEmpty(collect, i.URL)
				}
			}

			if extensions.IsEnterprise {
				assert.ElementsMatch(collect, []provisioning.RepositoryType{
					provisioning.LocalRepositoryType,
					provisioning.GitHubRepositoryType,
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

	// Viewer can list repositories
	t.Run("viewer can list repositories", func(t *testing.T) {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			rsp := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Do(context.Background())
			if !assert.NoError(collect, rsp.Error(), "viewer should be able to list repositories") {
				return
			}

			repos := &unstructured.UnstructuredList{}
			err := rsp.Into(repos)
			if !assert.NoError(collect, err, "should parse repository list") {
				return
			}

			// Should see the repositories created in this test
			assert.Len(collect, repos.Items, len(inputFiles), "viewer should see all repositories")

			// Verify each repository has expected data
			for _, repo := range repos.Items {
				name := repo.GetName()
				assert.NotEmpty(collect, name, "repository should have a name")

				spec, found, err := unstructured.NestedMap(repo.Object, "spec")
				assert.NoError(collect, err, "should have spec")
				assert.True(collect, found, "spec should be found")
				assert.NotEmpty(collect, spec, "spec should not be empty")
			}
		}, time.Second*10, time.Millisecond*100, "Expected viewer to list repositories")
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

func TestIntegrationProvisioning_RepositoryValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	for _, testCase := range []struct {
		name        string
		repo        *unstructured.Unstructured
		expectedErr string
	}{
		{
			name: "should succeed with valid local repository",
			repo: func() *unstructured.Unstructured {
				return helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
					"Name":        "valid-repo",
					"SyncEnabled": true,
				})
			}(),
		},
		{
			name: "should error if mutually exclusive finalizers are set",
			repo: func() *unstructured.Unstructured {
				localTmp := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
					"Name":        "repo-with-invalid-finalizers",
					"SyncEnabled": true,
				})

				// Setting finalizers to trigger a failure
				localTmp.SetFinalizers([]string{
					repository.CleanFinalizer,
					repository.ReleaseOrphanResourcesFinalizer,
					repository.RemoveOrphanResourcesFinalizer,
				})

				return localTmp
			}(),
			expectedErr: "cannot have both remove and release orphan resources finalizers",
		},
		{
			name: "should error if unknown finalizer is set",
			repo: func() *unstructured.Unstructured {
				localTmp := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
					"Name":        "repo-with-unknown-finalizer",
					"SyncEnabled": true,
				})

				// Setting an unknown finalizer
				localTmp.SetFinalizers([]string{
					repository.CleanFinalizer,
					"unknown.finalizer.example.com",
				})

				return localTmp
			}(),
			expectedErr: "unknown finalizer: unknown.finalizer.example.com",
		},
		{
			name: "should succeed with repository with no token but referencing Connection",
			repo: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Repository",
				"metadata": map[string]any{
					"name":      "repo-with-connection",
					"namespace": "default",
				},
				"spec": map[string]any{
					"title": "Repo With Connection",
					"type":  "github",
					"sync": map[string]any{
						"enabled": false,
						"target":  "folder",
					},
					"github": map[string]any{
						"url":    "https://github.com/grafana/grafana-git-sync-demo.git",
						"branch": "integration-test",
					},
					"connection": map[string]any{
						"name": "a-connection",
					},
					// Having workflows would normally trigger a secure.token check
					// But we should not do that as a connection is referenced
					"workflows": []string{
						string(provisioning.WriteWorkflow),
						string(provisioning.BranchWorkflow),
					},
				},
				// Missing secure.token
			}},
		},
		{
			name: "should accept a GH repo with empty branch",
			repo: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Repository",
				"metadata": map[string]any{
					"name":      "repo-with-empty-branch",
					"namespace": "default",
				},
				"spec": map[string]any{
					"title": "Repo With Connection",
					"type":  "github",
					"sync": map[string]any{
						"enabled": false,
						"target":  "folder",
					},
					"github": map[string]any{
						"url": "https://github.com/a/path",
						// Empty branch!
						"branch": "",
					},
					// Empty workflows to not trigger a token check
					"workflows": []string{},
				},
				"secure": map[string]any{
					"token": map[string]any{
						"create": "someToken",
					},
				},
			}},
		},
		{
			name: "should accept GitHub Enterprise URL",
			repo: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "provisioning.grafana.app/v0alpha1",
				"kind":       "Repository",
				"metadata": map[string]any{
					"name":      "repo-github-enterprise",
					"namespace": "default",
				},
				"spec": map[string]any{
					"title": "GitHub Enterprise Repository",
					"type":  "github",
					"sync": map[string]any{
						"enabled": false,
						"target":  "folder",
					},
					"github": map[string]any{
						"url":    "https://github.enterprise.example.com/org/repo",
						"branch": "main",
					},
					"workflows": []string{},
				},
				"secure": map[string]any{
					"token": map[string]any{
						"create": "someToken",
					},
				},
			}},
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				_, err := helper.Repositories.Resource.Create(ctx, testCase.repo, metav1.CreateOptions{})
				if testCase.expectedErr == "" {
					require.NoError(collect, err)
				} else {
					require.Error(collect, err)
					require.ErrorContains(collect, err, testCase.expectedErr)
				}
			}, waitTimeoutDefault, waitIntervalDefault)
		})
	}

	// Test Git repository path validation - ensure child paths are rejected
	t.Run("Git repository path validation", func(t *testing.T) {
		baseURL := "https://github.com/grafana/test-repo-path-validation"

		pathTests := []struct {
			name        string
			path        string
			expectError error
		}{
			{
				name:        "first repo with path 'demo/nested' should succeed",
				path:        "demo/nested",
				expectError: nil,
			},
			{
				name:        "second repo with child path 'demo/nested/again' should fail",
				path:        "demo/nested/again",
				expectError: provisioningAPIServer.ErrRepositoryParentFolderConflict,
			},
			{
				name:        "third repo with parent path 'demo' should fail",
				path:        "demo",
				expectError: provisioningAPIServer.ErrRepositoryParentFolderConflict,
			},
			{
				name:        "fourth repo with nested child path 'demo/nested/nested-second' should fail",
				path:        "demo/nested/again/two",
				expectError: provisioningAPIServer.ErrRepositoryParentFolderConflict,
			},
			{
				name:        "fifth repo with duplicate path 'demo/nested' should fail",
				path:        "demo/nested",
				expectError: provisioningAPIServer.ErrRepositoryDuplicatePath,
			},
		}

		for i, test := range pathTests {
			t.Run(test.name, func(t *testing.T) {
				repoName := fmt.Sprintf("git-path-test-%d", i+1)
				gitRepo := helper.RenderObject(t, "testdata/github-readonly.json.tmpl", map[string]any{
					"Name":        repoName,
					"URL":         baseURL,
					"Path":        test.path,
					"SyncEnabled": false, // Disable sync to avoid external dependencies
					"SyncTarget":  "folder",
				})

				_, err := helper.Repositories.Resource.Create(ctx, gitRepo, metav1.CreateOptions{FieldValidation: "Strict"})

				if test.expectError != nil {
					require.Error(t, err, "Expected error for repository with path: %s", test.path)
					require.ErrorContains(t, err, test.expectError.Error(), "Error should contain expected message for path: %s", test.path)
					var statusError *apierrors.StatusError
					if errors.As(err, &statusError) {
						require.Equal(t, metav1.StatusReasonInvalid, statusError.ErrStatus.Reason, "Should be a validation error")
						require.Equal(t, http.StatusUnprocessableEntity, int(statusError.ErrStatus.Code), "Should return 422 status code")
					}
				} else {
					require.NoError(t, err, "Expected success for repository with path: %s", test.path)
				}
			})
		}
	})

	t.Run("should update sync interval", func(t *testing.T) {
		r := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
			"Name":                "valid-repo-testinterval",
			"SyncEnabled":         true,
			"SyncIntervalSeconds": 5,
		})
		created, err := helper.Repositories.Resource.Create(ctx, r, metav1.CreateOptions{})
		require.NoError(t, err)

		createdRepo := unstructuredToRepository(t, created)
		require.Equal(t, int64(10), createdRepo.Spec.Sync.IntervalSeconds, "interval should be updated with default value")
	})

	t.Run("should automatically add finalizers during creation", func(t *testing.T) {
		r := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
			"Name":        "repo-auto-finalizers",
			"SyncEnabled": false,
		})

		// Verify the template doesn't have finalizers set (or set them explicitly to nil)
		r.SetFinalizers(nil)

		created, err := helper.Repositories.Resource.Create(ctx, r, metav1.CreateOptions{})
		require.NoError(t, err, "repository creation should succeed")

		// Verify finalizers were automatically added by the mutator
		createdRepo := unstructuredToRepository(t, created)
		require.NotEmpty(t, createdRepo.Finalizers, "finalizers should be automatically added")
		require.Contains(t, createdRepo.Finalizers, repository.RemoveOrphanResourcesFinalizer, "should contain RemoveOrphanResourcesFinalizer")
		require.Contains(t, createdRepo.Finalizers, repository.CleanFinalizer, "should contain CleanFinalizer")
	})

	t.Run("should re-add finalizers when removed during update", func(t *testing.T) {
		// Create a repository with finalizers
		r := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
			"Name":        "repo-update-finalizers",
			"SyncEnabled": false,
		})

		created, err := helper.Repositories.Resource.Create(ctx, r, metav1.CreateOptions{})
		require.NoError(t, err, "repository creation should succeed")

		createdRepo := unstructuredToRepository(t, created)
		require.NotEmpty(t, createdRepo.Finalizers, "finalizers should be present after creation")
		require.Contains(t, createdRepo.Finalizers, repository.RemoveOrphanResourcesFinalizer, "should contain RemoveOrphanResourcesFinalizer")
		require.Contains(t, createdRepo.Finalizers, repository.CleanFinalizer, "should contain CleanFinalizer")

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			storedRepo, err := helper.Repositories.Resource.Get(ctx, "repo-update-finalizers", metav1.GetOptions{})
			require.NoError(t, err, "repository retrieve should succeed")

			// Update the repository and try to remove finalizers
			storedRepo.SetFinalizers([]string{})
			updated, err := helper.Repositories.Resource.Update(ctx, storedRepo, metav1.UpdateOptions{})
			require.NoError(collect, err, "repository update should succeed")

			// Verify finalizers were re-added by the mutator
			updatedRepo := unstructuredToRepository(t, updated)
			require.NotEmpty(collect, updatedRepo.Finalizers, "finalizers should be re-added after update")
			require.Contains(collect, updatedRepo.Finalizers, repository.RemoveOrphanResourcesFinalizer, "should contain RemoveOrphanResourcesFinalizer")
			require.Contains(collect, updatedRepo.Finalizers, repository.CleanFinalizer, "should contain CleanFinalizer")
		}, waitTimeoutDefault, waitIntervalDefault)
	})
}

func TestIntegrationProvisioning_FailInvalidSchema(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	testutil.SkipIntegrationTestInShortMode(t)

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
		Target:             "folder",
		ExpectedDashboards: 3,
		ExpectedFolders:    3, // Folder sync creates an additional folder for the repository itself
	}

	helper.CreateRepo(t, testRepo)

	// By now, we should have synced, meaning we have data to read in the local Grafana instance!

	found, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := make([]string, 0, len(found.Items))
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
				// Create repository directly without health checks since we're only testing URL cleanup
				input := helper.RenderObject(t, "testdata/github-readonly.json.tmpl", map[string]any{
					"Name":        test.name,
					"URL":         test.input,
					"SyncTarget":  "folder",
					"SyncEnabled": false, // Disable sync since we're just testing URL cleanup,
					"Path":        fmt.Sprintf("grafana-%s/", test.name),
				})

				_, err := helper.Repositories.Resource.Create(ctx, input, metav1.CreateOptions{})
				require.NoError(t, err, "failed to create resource")

				obj, err := helper.Repositories.Resource.Get(ctx, test.name, metav1.GetOptions{})
				require.NoError(t, err, "failed to read back resource")

				url, _, err := unstructured.NestedString(obj.Object, "spec", "github", "url")
				require.NoError(t, err, "failed to read URL")
				require.Equal(t, test.output, url)
			})
		}
	})
}

func TestIntegrationProvisioning_RepositoryLimits(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Explicitly set max repositories to 10 to test the limit enforcement
	helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningMaxRepositories = 10
	})
	ctx := context.Background()

	originalName := "original-repo"
	// Create instance sync repository first
	originalRepo := TestRepo{
		Name:               originalName,
		Target:             "instance",
		Copies:             map[string]string{}, // No files needed for this test
		ExpectedDashboards: 0,
		ExpectedFolders:    0,
	}
	helper.CreateRepo(t, originalRepo)

	t.Run("folder sync is rejected when instance sync exists", func(t *testing.T) {
		folderRepo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        "folder-blocked-by-instance",
			"SyncEnabled": true,
			"SyncTarget":  "folder",
		})

		_, err := helper.Repositories.Resource.Create(ctx, folderRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "folder sync repository should be rejected when instance sync exists")

		// Verify the error message mentions the existing instance repository
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

		// Verify that the repository is now a folder sync
		// We verify with the listing APIs because it may take some time for the update to propagate
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
		instanceRepo := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        "instance-repo-blocked",
			"SyncEnabled": true,
			"SyncTarget":  "instance",
		})

		_, err := helper.Repositories.Resource.Create(ctx, instanceRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, err, "instance sync repository should be rejected when any other repository exists")

		statusError := helper.RequireApiErrorStatus(err, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Instance repository can only be created when no other repositories exist. Found: "+originalName)
	})

	t.Run("repository limit validation of 10 for folder syncs repositories", func(t *testing.T) {
		// Ensure the original repo is folder sync before testing limits
		// (it was changed to folder sync in a previous subtest)
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

		// Count existing repos (should be 1: original-repo)
		existingRepos, err := helper.Repositories.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "failed to list repositories")
		existingCount := len(existingRepos.Items)
		require.Equal(t, 1, existingCount, "should have 1 existing repository (original-repo)")

		// Create repos to reach the limit of 10 (we already have 1, so create 9 more)
		for i := 2; i <= 10; i++ {
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

		_, createErr := helper.Repositories.Resource.Create(ctx, eleventhRepo, metav1.CreateOptions{FieldValidation: "Strict"})
		require.Error(t, createErr, "11th repository should be rejected due to limit")

		statusError := helper.RequireApiErrorStatus(createErr, metav1.StatusReasonInvalid, http.StatusUnprocessableEntity)
		require.Contains(t, statusError.Message, "Maximum number of 10 repositories reached")
	})
}

func TestIntegrationProvisioning_RunLocalRepository(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const allPanels = "n1jR8vnnz"
	const repo = "local-local-examples"
	const targetPath = "all-panels.json"

	// Set up the repository.
	helper.CreateRepo(t, TestRepo{
		Name:                   repo,
		Target:                 "folder",
		ExpectedDashboards:     0,
		ExpectedFolders:        1, // folder sync creates a folder for the repo
		SkipResourceAssertions: false,
	})

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

	t.Run("folder not allowed", func(t *testing.T) {
		code := 0

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "folder.json").
			Body([]byte(`apiVersion: folder.grafana.app/v1beta1
kind: Folder
metadata:
  name: someFolder
spec:
  title: Test Folder
`)).Do(ctx).StatusCode(&code)
		require.Error(t, result.Error(), "should return error")
		require.Contains(t, result.Error().Error(), "cannot declare folders through files")
		require.Equal(t, http.StatusBadRequest, code, "expect bad request result")
	})
}

func TestIntegrationProvisioning_ImportAllPanelsFromLocalRepository(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
		Target:             "folder",
		Copies:             map[string]string{"testdata/all-panels.json": "all-panels.json"},
		ExpectedDashboards: 1,
		ExpectedFolders:    1, // folder sync creates a folder
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

	// Should be able to directly delete the managed resource
	err = helper.DashboardsV1.Resource.Delete(ctx, allPanels, metav1.DeleteOptions{})
	require.NoError(t, err, "user can delete")

	_, err = helper.DashboardsV1.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "should delete the internal resource")
	require.True(t, apierrors.IsNotFound(err))
}

func TestIntegrationProvisioning_DeleteRepositoryAndReleaseResources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "gh-repo"
	testRepo := TestRepo{
		Name:               repo,
		Template:           "testdata/github-readonly.json.tmpl",
		Target:             "folder",
		ExpectedDashboards: 3,
		ExpectedFolders:    3,
	}
	helper.CreateRepo(t, testRepo)

	// Checking resources are there and are managed
	foundFolders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list folders")
	for _, v := range foundFolders.Items {
		assert.Contains(t, v.GetAnnotations(), utils.AnnoKeyManagerKind)
		assert.Contains(t, v.GetAnnotations(), utils.AnnoKeyManagerIdentity)
	}

	foundDashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list dashboards")
	for _, v := range foundDashboards.Items {
		assert.Contains(t, v.GetAnnotations(), utils.AnnoKeyManagerKind)
		assert.Contains(t, v.GetAnnotations(), utils.AnnoKeyManagerIdentity)
		assert.Contains(t, v.GetAnnotations(), utils.AnnoKeySourcePath)
		assert.Contains(t, v.GetAnnotations(), utils.AnnoKeySourceChecksum)
	}

	_, err = helper.Repositories.Resource.Patch(ctx, repo, types.JSONPatchType, []byte(`[
		{
			"op": "replace",
			"path": "/metadata/finalizers",
			"value": ["cleanup", "release-orphan-resources"]
		}
	]`), metav1.PatchOptions{})
	require.NoError(t, err, "should successfully patch finalizers")

	err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
	require.NoError(t, err, "should delete repository")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "repository should be deleted")
	}, time.Second*10, time.Millisecond*50, "repository should be deleted")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		foundDashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		assert.NoError(t, err, "can list values")
		for _, v := range foundDashboards.Items {
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeyManagerKind)
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeyManagerIdentity)
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeySourcePath)
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeySourceChecksum)
		}
	}, time.Second*20, time.Millisecond*10, "Expected dashboards to be released")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		foundFolders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		assert.NoError(t, err, "can list values")
		for _, v := range foundFolders.Items {
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeyManagerKind)
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeyManagerIdentity)
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeySourcePath)
			assert.NotContains(t, v.GetAnnotations(), utils.AnnoKeySourceChecksum)
		}
	}, time.Second*20, time.Millisecond*10, "Expected folders to be released")
}

func TestIntegrationProvisioning_JobPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "job-permissions-test"
	testRepo := TestRepo{
		Name:               repo,
		Target:             "folder",
		Copies:             map[string]string{}, // No files needed for this test
		ExpectedDashboards: 0,
		ExpectedFolders:    1, // Repository creates a folder
	}
	helper.CreateRepo(t, testRepo)

	jobSpec := provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	}
	body := asJSON(jobSpec)

	t.Run("editor can POST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to POST jobs")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")

		// Verify the job was created
		obj, err := result.Get()
		require.NoError(t, err, "should get job object")
		unstruct, ok := obj.(*unstructured.Unstructured)
		require.True(t, ok, "expecting unstructured object")
		require.NotEmpty(t, unstruct.GetName(), "job should have a name")
	})

	t.Run("viewer cannot POST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to POST jobs")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("admin can POST jobs", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx).StatusCode(&statusCode)

		// Job might already exist from previous test, which is acceptable
		if apierrors.IsAlreadyExists(result.Error()) {
			// Wait for the existing job to complete
			helper.AwaitJobs(t, repo)
			return
		}

		require.NoError(t, result.Error(), "admin should be able to POST jobs")
		require.Equal(t, http.StatusAccepted, statusCode, "should return 202 Accepted")
	})
}

func TestIntegrationProvisioning_RefsPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "refs-permissions-test"
	testRepo := TestRepo{
		Name:               repo,
		Template:           "testdata/github-readonly.json.tmpl",
		Target:             "folder",
		ExpectedDashboards: 3,
		ExpectedFolders:    3, // Repository creates folders
	}
	helper.CreateRepo(t, testRepo)

	t.Run("editor can GET refs", func(t *testing.T) {
		var statusCode int
		result := helper.EditorREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("refs").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "editor should be able to GET refs")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")

		// Verify we can parse the refs and it contains at least main branch
		refs := &provisioning.RefList{}
		err := result.Into(refs)
		require.NoError(t, err, "should parse refs response")
		require.NotEmpty(t, refs.Items, "should have at least one ref")
	})

	t.Run("viewer cannot GET refs", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("refs").
			Do(ctx).StatusCode(&statusCode)

		require.Error(t, result.Error(), "viewer should not be able to GET refs")
		require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
		require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
	})

	t.Run("admin can GET refs", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("refs").
			Do(ctx).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "admin should be able to GET refs")
		require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
	})
}

func TestIntegrationProvisioning_EmptyPath(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	t.Run("repository with empty path syncs from root", func(t *testing.T) {
		const repo = "empty-path-test"
		testRepo := TestRepo{
			Name:     repo,
			Template: "testdata/github-empty-path.json.tmpl",
			Target:   "folder",
			Values: map[string]any{
				"SyncEnabled": true,
			},
			ExpectedDashboards: 3, // Syncs 3 dashboards from grafana/ directory
			ExpectedFolders:    6, // Creates 6 folders: repo root, assets, gifs, grafana, DemoFolder, DemoDeeperFolder
		}
		helper.CreateRepo(t, testRepo)

		// Verify the repository has empty path
		repoObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		require.NoError(t, err)
		path, _, _ := unstructured.NestedString(repoObj.Object, "spec", "github", "path")
		require.Equal(t, "", path, "repository should have empty path")

		// Clean up
		err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("multiple repositories with empty path - creation succeeds but sync warns on ownership conflicts", func(t *testing.T) {
		const repo1 = "empty-path-repo-1"
		const repo2 = "empty-path-repo-2"

		// Step 1: Create first repository with empty path - syncs successfully
		testRepo1 := TestRepo{
			Name:     repo1,
			Template: "testdata/github-empty-path.json.tmpl",
			Target:   "folder",
			Values: map[string]any{
				"SyncEnabled": true,
			},
			ExpectedDashboards: 3, // Successfully syncs 3 dashboards
			ExpectedFolders:    6, // Successfully creates 6 folders
		}
		helper.CreateRepo(t, testRepo1)

		// Step 2: Create second repository with same empty path
		// Creation should succeed (no duplicate path validation error)
		// but sync should warn because dashboards are owned by repo1
		testRepo2 := TestRepo{
			Name:     repo2,
			Template: "testdata/github-empty-path.json.tmpl",
			Target:   "folder",
			Values: map[string]any{
				"SyncEnabled": true,
			},
			SkipResourceAssertions: true, // Skip because we can't easily count per-repo resources
		}
		helper.CreateRepo(t, testRepo2)

		// Verify both repositories have empty paths
		repo1Obj, err := helper.Repositories.Resource.Get(ctx, repo1, metav1.GetOptions{})
		require.NoError(t, err)
		path1, _, _ := unstructured.NestedString(repo1Obj.Object, "spec", "github", "path")
		require.Equal(t, "", path1, "repo1 should have empty path")

		repo2Obj, err := helper.Repositories.Resource.Get(ctx, repo2, metav1.GetOptions{})
		require.NoError(t, err)
		path2, _, _ := unstructured.NestedString(repo2Obj.Object, "spec", "github", "path")
		require.Equal(t, "", path2, "repo2 should have empty path")

		// Verify repo2 sync completed with warning state (ownership conflicts)
		syncState, _, _ := unstructured.NestedString(repo2Obj.Object, "status", "sync", "state")
		require.Equal(t, "warning", syncState, "repo2 sync should complete with warning state due to ownership conflicts")

		// Verify global resource counts:
		// - Folders: 12 total (6 from repo1 + 6 from repo2) - folders are duplicated per repository
		// - Dashboards: 3 total (only from repo1) - repo2's dashboards fail with ownership conflicts
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 3, "should have 3 dashboards (only from repo1)")

		folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, folders.Items, 12, "should have 12 folders (6 from repo1 + 6 from repo2)")

		// Clean up
		err = helper.Repositories.Resource.Delete(ctx, repo1, metav1.DeleteOptions{})
		require.NoError(t, err)
		err = helper.Repositories.Resource.Delete(ctx, repo2, metav1.DeleteOptions{})
		require.NoError(t, err)
	})
}

func TestIntegrationProvisioning_RepositoryConnection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	decryptService := helper.GetEnv().DecryptService
	require.NotNil(t, decryptService, "decrypt service not wired properly")

	// Create a connection first
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Test Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "789012",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	c, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err, "failed to create connection")

	connectionName := c.GetName()

	require.EventuallyWithT(t, func(collectT *assert.CollectT) {
		c, err := helper.Connections.Resource.Get(ctx, connectionName, metav1.GetOptions{})
		require.NoError(collectT, err, "can list values")
		conn := unstructuredToConnection(t, c)
		require.NotEqual(collectT, 0, conn.Status.ObservedGeneration, "resource should be reconciled at least once")
		require.Equal(collectT, conn.Status.ObservedGeneration, conn.Generation, "resource should be reconciled")
		// Token should be there
		require.False(collectT, conn.Secure.Token.IsZero())
	}, time.Second*10, time.Second, "Expected connection to be reconciled")

	// Create a repository WITH the connection
	repoWithConnection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]any{
			"name":      "repo-with-connection",
			"namespace": "default",
		},
		"spec": map[string]any{
			"title": "Repo With Connection",
			"type":  "github",
			"sync": map[string]any{
				"enabled": false,
				"target":  "folder",
			},
			"github": map[string]any{
				"url":    "https://github.com/some/url",
				"branch": "main",
			},
			"connection": map[string]any{
				"name": connectionName,
			},
		},
	}}

	_, err = helper.Repositories.Resource.Create(ctx, repoWithConnection, createOptions)
	require.NoError(t, err, "failed to create repository with connection")

	require.EventuallyWithT(t, func(collectT *assert.CollectT) {
		repo, err := helper.Repositories.Resource.Get(ctx, "repo-with-connection", metav1.GetOptions{})
		require.NoError(collectT, err, "can get repository")
		r := unstructuredToRepository(t, repo)
		require.NotEqual(collectT, 0, r.Status.ObservedGeneration, "resource should be reconciled at least once")
		require.Equal(collectT, r.Status.ObservedGeneration, r.Generation, "resource should be reconciled")
		// Token should be there
		require.False(collectT, r.Secure.Token.IsZero())
		// Verify fieldErrors field exists (may be empty or contain validation warnings)
		// fieldErrors are populated from testResults and may contain warnings even when healthy
		require.NotNil(collectT, r.Status.FieldErrors, "fieldErrors field should exist in status")

		decrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", r.GetNamespace(), r.Secure.Token.Name)
		require.NoError(collectT, err, "decryption error")
		require.Len(collectT, decrypted, 1)

		val := decrypted[r.Secure.Token.Name].Value()
		require.NotNil(collectT, val)
		require.Equal(collectT, "someToken", val.DangerouslyExposeAndConsumeValue())
	}, time.Second*10, time.Second, "Expected repo to be reconciled")

	repoUnstructured, err := helper.Repositories.Resource.Get(ctx, "repo-with-connection", metav1.GetOptions{})
	require.NoError(t, err, "can get repository")
	firstReconciledRepo := unstructuredToRepository(t, repoUnstructured)
	// Setting up main triggering conditions to verify token is re-generated when
	// needed, even if all other conditions are not triggered
	now := time.Now()
	firstReconciledRepo.Status.ObservedGeneration = firstReconciledRepo.Generation
	firstReconciledRepo.Status.Sync = provisioning.SyncStatus{
		State:     provisioning.JobStateSuccess,
		JobID:     firstReconciledRepo.Status.Sync.JobID,
		Started:   now.UnixMilli(),
		Finished:  now.UnixMilli(),
		Scheduled: now.UnixMilli(),
		LastRef:   firstReconciledRepo.Status.Sync.LastRef,
	}
	firstReconciledRepo.Status.Health = provisioning.HealthStatus{
		Healthy: true,
		Checked: now.UnixMilli(),
	}
	firstReconciledRepo.Status.Token = provisioning.TokenStatus{
		LastUpdated: now.Add(-2 * time.Minute).UnixMilli(),
		Expiration:  now.Add(-time.Minute).UnixMilli(),
	}
	firstReconciledRepo.Status.FieldErrors = []provisioning.ErrorDetails{}
	firstReconciledRepo.Status.Conditions = []metav1.Condition{
		{
			Type:               provisioning.ConditionTypeReady,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: firstReconciledRepo.Generation,
			LastTransitionTime: metav1.Time{Time: now},
			Reason:             provisioning.ReasonAvailable,
		},
	}
	updatedRepo := repositoryToUnstructured(t, firstReconciledRepo)
	// This should also trigger a reconciliation loop
	_, err = helper.Repositories.Resource.UpdateStatus(ctx, updatedRepo, metav1.UpdateOptions{})
	require.NoError(t, err, "failed to update status")

	require.EventuallyWithT(t, func(collectT *assert.CollectT) {
		repo, err := helper.Repositories.Resource.Get(ctx, "repo-with-connection", metav1.GetOptions{})
		require.NoError(collectT, err, "can get repository")
		r := unstructuredToRepository(t, repo)
		// Token should be there
		require.False(collectT, r.Secure.Token.IsZero())
		// and different from the previous one
		require.NotEqual(collectT,
			firstReconciledRepo.Secure.Token.Name,
			r.Secure.Token.Name,
			"token should be updated",
		)

		// Just checking the token is what is going to be returned by the mock GH API
		decrypted, err := decryptService.Decrypt(ctx, "provisioning.grafana.app", r.GetNamespace(), r.Secure.Token.Name)
		require.NoError(collectT, err, "decryption error")
		require.Len(collectT, decrypted, 1)

		val := decrypted[r.Secure.Token.Name].Value()
		require.NotNil(collectT, val)
		require.Equal(collectT, "someToken", val.DangerouslyExposeAndConsumeValue())
	}, time.Second*10, time.Second, "Expected repo token to be regenerated")
}

func TestIntegrationProvisioning_RepositoryUnhealthyWithValidationErrors(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	repoClient := provisioningClient.ProvisioningV0alpha1().Repositories(namespace)
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

	// Create a connection first
	connection := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      "test-connection-invalid-repo",
			"namespace": namespace,
		},
		"spec": map[string]any{
			"title": "Test Connection",
			"type":  "github",
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "789012",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}

	c, err := helper.CreateGithubConnection(t, ctx, connection)
	require.NoError(t, err, "failed to create connection")

	connectionName := c.GetName()

	t.Cleanup(func() {
		_ = helper.Connections.Resource.Delete(ctx, connectionName, metav1.DeleteOptions{})
	})

	t.Run("repository with non-existent branch becomes unhealthy with fieldErrors", func(t *testing.T) {
		// Create a repository with a non-existent branch
		repoUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "test-repo-invalid-branch",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Repo With Invalid Branch",
				"type":  "github",
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"github": map[string]any{
					"url":    "https://github.com/grafana/grafana-git-sync-demo",
					"branch": "non-existent-branch-12345", // This branch doesn't exist
				},
				"connection": map[string]any{
					"name": connectionName,
				},
			},
		}}

		createdUnstructured, err := helper.Repositories.Resource.Create(ctx, repoUnstructured, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		repoName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - repository should become unhealthy due to invalid branch
		require.Eventually(t, func() bool {
			repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Repository should be reconciled and marked unhealthy
			return repo.Status.ObservedGeneration == repo.Generation &&
				repo.Status.Health.Checked > 0 &&
				!repo.Status.Health.Healthy
		}, 15*time.Second, 500*time.Millisecond, "repository should be reconciled and marked unhealthy")

		// Verify the repository is unhealthy and has fieldErrors
		repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, repo.Status.Health.Healthy, "repository should be unhealthy")
		assert.Equal(t, repo.Generation, repo.Status.ObservedGeneration, "repository should be reconciled")
		assert.Greater(t, repo.Status.Health.Checked, int64(0), "health check timestamp should be set")

		// Verify fieldErrors are populated with validation errors - be strict and explicit
		require.Len(t, repo.Status.FieldErrors, 1, "fieldErrors should contain exactly one error")

		tokenError := repo.Status.FieldErrors[0]

		assert.Equal(t, metav1.CauseTypeFieldValueInvalid, tokenError.Type, "Type must be FieldValueInvalid")
		assert.Equal(t, "secure.token", tokenError.Field, "Field must be secure.token")
		assert.Equal(t, "not authorized", tokenError.Detail, "Detail must be 'not authorized'")
		assert.Empty(t, tokenError.Origin, "Origin must be empty")

		t.Logf("Verified token fieldError: Type=%s, Field=%s, Detail=%s, Origin=%s",
			tokenError.Type, tokenError.Field, tokenError.Detail, tokenError.Origin)
	})

	t.Run("repository with non-existent repository URL becomes unhealthy with fieldErrors", func(t *testing.T) {
		// Create a repository with a non-existent repository URL
		repoUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "test-repo-invalid-url",
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Repo With Invalid URL",
				"type":  "github",
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"github": map[string]any{
					"url":    "https://github.com/non-existent-org/non-existent-repo-12345",
					"branch": "main",
				},
				"connection": map[string]any{
					"name": connectionName,
				},
			},
		}}

		createdUnstructured, err := helper.Repositories.Resource.Create(ctx, repoUnstructured, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		repoName := createdUnstructured.GetName()

		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - repository should become unhealthy due to invalid repository URL
		require.Eventually(t, func() bool {
			repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Repository should be reconciled and marked unhealthy
			return repo.Status.ObservedGeneration == repo.Generation &&
				repo.Status.Health.Checked > 0 &&
				!repo.Status.Health.Healthy
		}, 15*time.Second, 500*time.Millisecond, "repository should be reconciled and marked unhealthy")

		// Verify the repository is unhealthy and has fieldErrors
		repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.False(t, repo.Status.Health.Healthy, "repository should be unhealthy")
		assert.Equal(t, repo.Generation, repo.Status.ObservedGeneration, "repository should be reconciled")
		assert.Greater(t, repo.Status.Health.Checked, int64(0), "health check timestamp should be set")

		// Verify fieldErrors are populated with validation errors - be strict and explicit
		require.Len(t, repo.Status.FieldErrors, 1, "fieldErrors should contain exactly one error")

		tokenError := repo.Status.FieldErrors[0]

		// Verify all fields explicitly - authorization check fails first before URL check
		assert.Equal(t, metav1.CauseTypeFieldValueInvalid, tokenError.Type, "Type must be FieldValueInvalid")
		assert.Equal(t, "secure.token", tokenError.Field, "Field must be secure.token")
		assert.Equal(t, "not authorized", tokenError.Detail, "Detail must be 'not authorized'")
		assert.Empty(t, tokenError.Origin, "Origin must be empty")

		t.Logf("Verified token fieldError: Type=%s, Field=%s, Detail=%s, Origin=%s",
			tokenError.Type, tokenError.Field, tokenError.Detail, tokenError.Origin)
	})
}

func TestIntegrationRepositoryController_FieldErrorsCleared(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	repoClient := provisioningClient.ProvisioningV0alpha1().Repositories(namespace)

	t.Run("repository fieldErrors are cleared when repository becomes healthy", func(t *testing.T) {
		// Create a local repository that will be healthy
		repoPath := helper.ProvisioningPath
		repoName := "test-repo-field-errors-cleared"

		// Create repository directory
		err := os.MkdirAll(repoPath, 0o750)
		require.NoError(t, err)

		// Create a repository that will be healthy initially
		repoUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      repoName,
				"namespace": namespace,
			},
			"spec": map[string]any{
				"title": "Repo Field Errors Cleared Test",
				"type":  "local",
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"local": map[string]any{
					"path": repoPath,
				},
			},
		}}

		createdUnstructured, err := helper.Repositories.Resource.Create(ctx, repoUnstructured, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		})

		// Wait for repository to become healthy
		require.Eventually(t, func() bool {
			repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return repo.Status.ObservedGeneration == repo.Generation &&
				repo.Status.Health.Checked > 0 &&
				repo.Status.Health.Healthy &&
				len(repo.Status.FieldErrors) == 0
		}, 15*time.Second, 500*time.Millisecond, "repository should be healthy")

		// Verify repository is healthy with no fieldErrors
		repoHealthy, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.True(t, repoHealthy.Status.Health.Healthy, "repository should be healthy")
		assert.Empty(t, repoHealthy.Status.FieldErrors, "fieldErrors should be empty when healthy")

		// Remove the repository directory to make it unhealthy
		err = os.RemoveAll(repoPath)
		require.NoError(t, err)

		// Trigger health check by updating the repository spec
		latestUnstructured, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		updatedUnstructured := latestUnstructured.DeepCopy()
		// Update title to trigger reconciliation
		updatedUnstructured.Object["spec"].(map[string]any)["title"] = "Updated Title"
		_, err = helper.Repositories.Resource.Update(ctx, updatedUnstructured, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Wait for repository to become unhealthy with fieldErrors
		require.Eventually(t, func() bool {
			repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return repo.Status.ObservedGeneration == repo.Generation &&
				repo.Status.Health.Checked > 0 &&
				!repo.Status.Health.Healthy &&
				len(repo.Status.FieldErrors) > 0
		}, 15*time.Second, 500*time.Millisecond, "repository should be unhealthy with fieldErrors")

		// Verify fieldErrors are present
		repoWithErrors, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		require.Greater(t, len(repoWithErrors.Status.FieldErrors), 0, "fieldErrors should be present when unhealthy")

		// Recreate the repository directory to make it healthy again
		err = os.MkdirAll(repoPath, 0o750)
		require.NoError(t, err)

		// Trigger health check by updating the repository spec again
		latestUnstructured2, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		updatedUnstructured2 := latestUnstructured2.DeepCopy()
		// Update title again to trigger reconciliation
		updatedUnstructured2.Object["spec"].(map[string]any)["title"] = "Final Title"
		_, err = helper.Repositories.Resource.Update(ctx, updatedUnstructured2, metav1.UpdateOptions{})
		require.NoError(t, err)

		// Wait for reconciliation - repository should become healthy and fieldErrors should be cleared
		require.Eventually(t, func() bool {
			repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// First ensure it's reconciled
			if repo.Status.ObservedGeneration != repo.Generation {
				return false
			}
			// Then check health
			if repo.Status.Health.Checked == 0 || !repo.Status.Health.Healthy {
				return false
			}
			// Finally check fieldErrors are cleared
			return len(repo.Status.FieldErrors) == 0
		}, 30*time.Second, 1*time.Second, "repository should be healthy with fieldErrors cleared")

		// Verify fieldErrors are cleared
		repoHealthyAgain, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.True(t, repoHealthyAgain.Status.Health.Healthy, "repository should be healthy")
		assert.Empty(t, repoHealthyAgain.Status.FieldErrors, "fieldErrors should be cleared when repository becomes healthy")
	})
}

func TestIntegrationRepositoryController_DefaultBranch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()
	namespace := "default"
	defaultBranchName := "defaultBranchName"

	repoFactory := helper.GetEnv().GithubRepoFactory
	repoFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
				repo := &github.Repository{
					ID:            github.Ptr(int64(12345)),
					Name:          github.Ptr("name"),
					DefaultBranch: &defaultBranchName,
				}
				_, _ = w.Write(ghmock.MustMarshal(repo))
			}),
		),
	)
	helper.SetGithubRepositoryFactory(repoFactory)

	// Create typed client from REST config
	restConfig := helper.Org1.Admin.NewRestConfig()
	provisioningClient, err := clientset.NewForConfig(restConfig)
	require.NoError(t, err)
	repoClient := provisioningClient.ProvisioningV0alpha1().Repositories(namespace)

	t.Run("default branch gets retrieved for repository", func(t *testing.T) {
		repoName := "repo-with-empty-branch"

		// Create a repository that will be healthy initially
		repoUnstructured := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "repo-with-empty-branch",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Repo With Connection",
				"type":  "github",
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
				"github": map[string]any{
					"url": "https://github.com/a/path",
					// Empty branch!
					"branch": "",
				},
				// Empty workflows to not trigger a token check
				"workflows": []string{},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": "someToken",
				},
			},
		}}

		createdUnstructured, err := helper.Repositories.Resource.Create(ctx, repoUnstructured, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, createdUnstructured)

		t.Cleanup(func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		})

		// Wait for reconciliation - repository should have branch name
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repo, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			require.NoError(collect, err, "issue getting repo")
			require.Equal(collect, repo.Generation, repo.Status.ObservedGeneration, "repo should be reconciled")
			require.Equal(collect, defaultBranchName, repo.Spec.GitHub.Branch, "default branch should be set")
		}, 30*time.Second, 1*time.Second, "repository should have default branch")
	})
}

func TestIntegrationRepositoryController_EnterpriseWiring(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !extensions.IsEnterprise {
		t.Skip("Skipping integration test when not enterprise")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	t.Run("GitLab repository can be created and reconciled", func(t *testing.T) {
		token := base64.StdEncoding.EncodeToString([]byte("test-gitlab-token"))

		repository := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "test-gitlab-repo",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test GitLab Repository",
				"type":  string(provisioning.GitLabRepositoryType),
				"gitlab": map[string]any{
					"url":    "https://gitlab.com/test/repo.git",
					"branch": "main",
					"path":   "dashboards",
				},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": token,
				},
			},
		}}

		// CREATE
		created, err := helper.Repositories.Resource.Create(ctx, repository, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create GitLab repository")
		require.NotNil(t, created)

		repoName := created.GetName()
		require.NotEmpty(t, repoName, "repository name should not be empty")

		// Cleanup
		defer func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		}()

		// READ
		output, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back GitLab repository")
		assert.Equal(t, repoName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.GitLabRepositoryType), spec["type"], "type should be gitlab")

		// Get typed client for status checks
		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		repoClient := provClient.ProvisioningV0alpha1().Repositories("default")

		// Wait for reconciliation - controller should process the resource
		// With fake credentials, the git operations will fail, but reconciliation should happen
		require.Eventually(t, func() bool {
			updated, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			// Check that controller has reconciled (ObservedGeneration matches Generation)
			// and that health check was attempted (Checked > 0)
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "repository should be reconciled by controller")

		// Verify reconciliation status
		reconciled, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)

		// Controller should have set ObservedGeneration - this proves reconciliation happened
		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the repository")

		// Health check should have been attempted - proves the controller processed it
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		// Should have a ready condition - proves status was updated
		readyCondition := meta.FindStatusCondition(reconciled.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "should have ready condition")

		t.Logf("GitLab repository reconciled successfully. Health: %v, ObservedGen: %d, Checked: %d",
			reconciled.Status.Health.Healthy, reconciled.Status.ObservedGeneration, reconciled.Status.Health.Checked)
	})

	t.Run("Bitbucket repository can be and reconciled", func(t *testing.T) {
		token := base64.StdEncoding.EncodeToString([]byte("test-bitbucket-token"))

		repository := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name":      "test-bitbucket-repo",
				"namespace": "default",
			},
			"spec": map[string]any{
				"title": "Test Bitbucket Repository",
				"type":  string(provisioning.BitbucketRepositoryType),
				"bitbucket": map[string]any{
					"url":    "https://bitbucket.org/workspace/repo.git",
					"branch": "main",
					"path":   "dashboards",
				},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": token,
				},
			},
		}}

		// CREATE
		created, err := helper.Repositories.Resource.Create(ctx, repository, metav1.CreateOptions{})
		require.NoError(t, err, "failed to create Bitbucket repository")
		require.NotNil(t, created)

		repoName := created.GetName()
		require.NotEmpty(t, repoName, "repository name should not be empty")

		// Cleanup
		defer func() {
			_ = helper.Repositories.Resource.Delete(ctx, repoName, metav1.DeleteOptions{})
		}()

		// READ
		output, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err, "failed to read back Bitbucket repository")
		assert.Equal(t, repoName, output.GetName(), "name should be equal")

		spec := output.Object["spec"].(map[string]any)
		assert.Equal(t, string(provisioning.BitbucketRepositoryType), spec["type"], "type should be bitbucket")

		// Get typed client for status checks
		restConfig := helper.Org1.Admin.NewRestConfig()
		provClient, err := clientset.NewForConfig(restConfig)
		require.NoError(t, err, "failed to create provisioning client")
		repoClient := provClient.ProvisioningV0alpha1().Repositories("default")

		// Wait for reconciliation
		require.Eventually(t, func() bool {
			updated, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
			if err != nil {
				return false
			}
			return updated.Status.ObservedGeneration == updated.Generation &&
				updated.Status.Health.Checked > 0
		}, 15*time.Second, 500*time.Millisecond, "repository should be reconciled by controller")

		// Verify reconciliation status
		reconciled, err := repoClient.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, reconciled.Generation, reconciled.Status.ObservedGeneration,
			"controller should have reconciled the repository")
		assert.Greater(t, reconciled.Status.Health.Checked, int64(0),
			"health check should have been attempted")

		readyCondition := meta.FindStatusCondition(reconciled.Status.Conditions, provisioning.ConditionTypeReady)
		assert.NotNil(t, readyCondition, "should have ready condition")

		t.Logf("Bitbucket repository reconciled successfully. Health: %v, ObservedGen: %d, Checked: %d",
			reconciled.Status.Health.Healthy, reconciled.Status.ObservedGeneration, reconciled.Status.Health.Checked)
	})

	t.Run("All repository types are supported", func(t *testing.T) {
		// List all supported repository types

		supportedTypes := []provisioning.RepositoryType{
			provisioning.GitHubRepositoryType,
			provisioning.GitLabRepositoryType,
			provisioning.BitbucketRepositoryType,
			provisioning.GitRepositoryType,
			provisioning.LocalRepositoryType,
		}

		for _, repoType := range supportedTypes {
			t.Run(string(repoType), func(t *testing.T) {
				// We just check that we can create the object without factory errors
				// Validation errors are expected if configuration is missing/invalid
				repo := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "provisioning.grafana.app/v0alpha1",
					"kind":       "Repository",
					"metadata": map[string]any{
						"generateName": "test-",
						"namespace":    "default",
					},
					"spec": map[string]any{
						"title": "Test Repository",
						"type":  string(repoType),
					},
				}}

				// Try to create - we expect validation error, not "type not supported"
				_, err := helper.Repositories.Resource.Create(ctx, repo, metav1.CreateOptions{})
				if err != nil {
					// Should be a validation error, not "type not supported"
					assert.NotContains(t, err.Error(), "is not supported",
						"type %s should be supported by factory", repoType)
				}
			})
		}
	})
}

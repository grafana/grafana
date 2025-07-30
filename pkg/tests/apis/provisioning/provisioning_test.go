package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/tests/apis"
)

// printFileTree prints the directory structure as a tree for debugging purposes
func printFileTree(t *testing.T, rootPath string) {
	t.Helper()
	t.Logf("File tree for %s:", rootPath)

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}

		if relPath == "." {
			return nil
		}

		depth := strings.Count(relPath, string(filepath.Separator))
		indent := strings.Repeat("  ", depth)

		if d.IsDir() {
			t.Logf("%s├── %s/", indent, d.Name())
		} else {
			info, err := d.Info()
			if err != nil {
				t.Logf("%s├── %s (error reading info)", indent, d.Name())
			} else {
				t.Logf("%s├── %s (%d bytes)", indent, d.Name(), info.Size())
			}
		}

		return nil
	})
	if err != nil {
		t.Logf("Error walking directory: %v", err)
	}
}

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

			_, err := helper.Repositories.Resource.Create(ctx, input, createOptions)
			require.NoError(t, err, "failed to create resource")

			name := mustNestedString(input.Object, "metadata", "name")
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
		settings := &provisioning.RepositoryViewList{}
		rsp := helper.ViewerREST.Get().
			Namespace("default").
			Suffix("settings").
			Do(context.Background())
		require.NoError(t, rsp.Error())
		err := rsp.Into(settings)
		require.NoError(t, err)
		require.Len(t, settings.Items, len(inputFiles))

		// FIXME: this should be an enterprise integration test
		if extensions.IsEnterprise {
			require.ElementsMatch(t, []provisioning.RepositoryType{
				provisioning.LocalRepositoryType,
				provisioning.GitHubRepositoryType,
				provisioning.GitRepositoryType,
				provisioning.BitbucketRepositoryType,
				provisioning.GitLabRepositoryType,
			}, settings.AvailableRepositoryTypes)
		} else {
			require.ElementsMatch(t, []provisioning.RepositoryType{
				provisioning.LocalRepositoryType,
				provisioning.GitHubRepositoryType,
			}, settings.AvailableRepositoryTypes)
		}
	})

	t.Run("Repositories are reported in stats", func(t *testing.T) {
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
		require.Equal(t, map[string]any{
			"stats.repository.github.count": 1.0,
			"stats.repository.local.count":  1.0,
		}, stats)
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

	var jobObj *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionPull,
				Pull:   &provisioning.SyncJobOptions{},
			})).
			SetHeader("Content-Type", "application/json").
			Do(t.Context())
		require.NoError(collect, result.Error())
		job, err := result.Get()
		require.NoError(collect, err)
		var ok bool
		jobObj, ok = job.(*unstructured.Unstructured)
		assert.True(collect, ok, "expecting unstructured object, but got %T", job)
	}, time.Second*10, time.Millisecond*10, "Expected to be able to start a sync job")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		// helper.TriggerJobProcessing(t)
		result, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{},
			"jobs", string(jobObj.GetUID()))

		if apierrors.IsNotFound(err) {
			assert.Fail(collect, "job '%s' not found yet yet", jobObj.GetName())
			return // continue trying
		}

		// Can fail fast here -- the jobs are immutable
		require.NoError(t, err)
		require.NotNil(t, result)

		job := &provisioning.Job{}
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, job)
		require.NoError(t, err, "should convert to Job object")

		assert.Equal(t, provisioning.JobStateError, job.Status.State)
		assert.Equal(t, job.Status.Message, "completed with errors")
		assert.Equal(t, job.Status.Errors[0], "Dashboard.dashboard.grafana.app \"invalid-schema-uid\" is invalid: [spec.panels.0.repeatDirection: Invalid value: conflicting values \"h\" and \"this is not an allowed value\", spec.panels.0.repeatDirection: Invalid value: conflicting values \"v\" and \"this is not an allowed value\"]")
	}, time.Second*10, time.Millisecond*10, "Expected provisioning job to conclude with the status failed")

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
	_, err := helper.Repositories.Resource.Create(ctx,
		helper.RenderObject(t, "testdata/github-readonly.json.tmpl", map[string]any{
			"Name":        repo,
			"SyncEnabled": true,
			"SyncTarget":  "instance",
			"Path":        "grafana/",
		}),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)

	helper.SyncAndWait(t, repo, nil)

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
					"Name": test.name,
					"URL":  test.input,
				})

				_, err := helper.Repositories.Resource.Create(ctx, input, metav1.CreateOptions{})
				require.NoError(t, err, "failed to create resource")

				obj, err := helper.Repositories.Resource.Get(ctx, test.name, metav1.GetOptions{})
				require.NoError(t, err, "failed to read back resource")

				url, _, err := unstructured.NestedString(obj.Object, "spec", "github", "url")
				require.NoError(t, err, "failed to read URL")
				require.Equal(t, test.output, url)

				err = helper.Repositories.Resource.Delete(ctx, test.name, metav1.DeleteOptions{})
				require.NoError(t, err, "failed to delete")
			})
		}
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
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{"Name": repo})
	obj, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)
	name, _, _ := unstructured.NestedString(obj.Object, "metadata", "name")
	require.Equal(t, repo, name, "wrote the expected name")

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
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "../../all-panels.json")
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

		name, _, _ = unstructured.NestedString(obj.Object, "resource", "upsert", "metadata", "name")
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
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "all-panels.json")
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
	})

	// We create the repository
	_, err = helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

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

func TestProvisioning_ExportUnifiedToRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Write dashboards at
	dashboard := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v0.yaml")
	_, err := helper.DashboardsV0.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v0 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err = helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2alpha1.yaml")
	_, err = helper.DashboardsV2alpha1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2alpha1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	_, err = helper.DashboardsV2beta1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2beta1 dashboard")

	// Now for the repository.
	const repo = "local-repository"
	createBody := helper.RenderObject(t, "exportunifiedtorepository/repository.json.tmpl", map[string]any{"Name": repo})
	_, err = helper.Repositories.Resource.Create(ctx, createBody, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create repository")

	// Now export...
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		SetHeader("Content-Type", "application/json").
		Body(asJSON(&provisioning.JobSpec{
			Push: &provisioning.ExportJobOptions{
				Folder: "", // export entire instance
				Path:   "", // no prefix necessary for testing
			},
		})).
		Do(ctx)
	require.NoError(t, result.Error())

	// And time to assert.
	helper.AwaitJobs(t, repo)

	type props struct {
		title      string
		apiVersion string
		name       string
		fileName   string
	}

	printFileTree(t, helper.ProvisioningPath)

	// Check that each file was exported with its stored version
	for _, test := range []props{
		{title: "Test dashboard. Created at v0", apiVersion: "dashboard.grafana.app/v0alpha1", name: "test-v0", fileName: "test-dashboard-created-at-v0.json"},
		{title: "Test dashboard. Created at v1", apiVersion: "dashboard.grafana.app/v1beta1", name: "test-v1", fileName: "test-dashboard-created-at-v1.json"},
		{title: "Test dashboard. Created at v2alpha1", apiVersion: "dashboard.grafana.app/v2alpha1", name: "test-v2alpha1", fileName: "test-dashboard-created-at-v2alpha1.json"},
		{title: "Test dashboard. Created at v2beta1", apiVersion: "dashboard.grafana.app/v2beta1", name: "test-v2beta1", fileName: "test-dashboard-created-at-v2beta1.json"},
	} {
		fpath := filepath.Join(helper.ProvisioningPath, test.fileName)
		//nolint:gosec // we are ok with reading files in testdata
		body, err := os.ReadFile(fpath)
		require.NoError(t, err, "exported file was not created at path %s", fpath)
		obj := map[string]any{}
		err = json.Unmarshal(body, &obj)
		require.NoError(t, err, "exported file not json %s", fpath)

		val, _, err := unstructured.NestedString(obj, "apiVersion")
		require.NoError(t, err)
		require.Equal(t, test.apiVersion, val)

		val, _, err = unstructured.NestedString(obj, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, test.title, val)

		val, _, err = unstructured.NestedString(obj, "metadata", "name")
		require.NoError(t, err)
		require.Equal(t, test.name, val)

		require.Nil(t, obj["status"], "should not have a status element")
	}
}

func TestIntegrationProvisioning_DeleteResources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "delete-test-repo"
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
		"SyncTarget":  "instance",
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Copy the dashboards to the repository path
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "dashboard1.json")
	helper.CopyToProvisioningPath(t, "testdata/text-options.json", "folder/dashboard2.json")
	helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "folder/nested/dashboard3.json")
	// make sure we don't fail when there is a .keep file in a folder
	helper.CopyToProvisioningPath(t, "testdata/.keep", "folder/nested/.keep")

	// Trigger and wait for a sync job to finish
	helper.SyncAndWait(t, repo, nil)

	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 3, len(dashboards.Items))

	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 2, len(folders.Items))

	t.Run("delete individual dashboard file, should delete from repo and grafana", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)
		require.NoError(t, result.Error())
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.Error(t, err)
		dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 2, len(dashboards.Items))
	})

	t.Run("delete folder, should delete from repo and grafana all nested resources too", func(t *testing.T) {
		// need to delete directly through the url, because the k8s client doesn't support `/` in a subresource
		// but that is needed by gitsync to know that it is a folder
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		url := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/folder/", addr, repo)
		req, err := http.NewRequest(http.MethodDelete, url, nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// should be deleted from the repo
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder")
		require.Error(t, err)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard2.json")
		require.Error(t, err)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "nested")
		require.Error(t, err)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "nested", "dashboard3.json")
		require.Error(t, err)

		// all should be deleted from grafana
		for _, d := range dashboards.Items {
			_, err = helper.DashboardsV1.Resource.Get(ctx, d.GetName(), metav1.GetOptions{})
			require.Error(t, err)
		}
		for _, f := range folders.Items {
			_, err = helper.Folders.Resource.Get(ctx, f.GetName(), metav1.GetOptions{})
			require.Error(t, err)
		}
	})

	t.Run("deleting a non-existent file should fail", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "non-existent.json").
			Do(ctx)
		require.Error(t, result.Error())
	})
}

func TestIntegrationProvisioning_DeleteJob(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "delete-job-test-repo"
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
		"SyncTarget":  "instance",
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)
	// Copy multiple test files to the repository
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "dashboard1.json")
	helper.CopyToProvisioningPath(t, "testdata/text-options.json", "dashboard2.json")
	helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "folder/dashboard3.json")

	// Trigger and wait for initial sync to populate resources
	helper.SyncAndWait(t, repo, nil)

	// Verify initial state - should have 3 dashboards and 1 folder
	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 3, len(dashboards.Items), "should have 3 dashboards after sync")

	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, len(folders.Items), "should have 1 folder after sync")

	t.Run("delete single file", func(t *testing.T) {
		// Create delete job for single file
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Paths: []string{"dashboard1.json"},
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create delete job")

		// Wait for job to complete
		helper.AwaitJobs(t, repo)

		// Verify file is deleted from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.Error(t, err, "file should be deleted from repository")
		require.True(t, apierrors.IsNotFound(err), "should be not found error")

		// Verify dashboard is removed from Grafana after sync
		dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 2, len(dashboards.Items), "should have 2 dashboards after delete")

		// Verify other files still exist
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.NoError(t, err, "other files should still exist")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.NoError(t, err, "nested files should still exist")
	})

	t.Run("delete multiple files", func(t *testing.T) {
		// Create delete job for multiple files
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Paths: []string{"dashboard2.json", "folder/dashboard3.json"},
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create delete job")

		// Wait for job to complete
		helper.AwaitJobs(t, repo)

		// Verify files are deleted from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.Error(t, err, "dashboard2.json should be deleted")
		require.True(t, apierrors.IsNotFound(err))

		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.Error(t, err, "folder/dashboard3.json should be deleted")
		require.True(t, apierrors.IsNotFound(err))

		// Verify all dashboards are removed from Grafana after sync
		dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 0, len(dashboards.Items), "should have 0 dashboards after deleting all")
	})

	t.Run("delete by resource reference", func(t *testing.T) {
		// Create modified test files with unique UIDs for ResourceRef testing
		// Read and modify the testdata files to have unique UIDs that don't conflict with existing resources
		allPanelsContent := helper.LoadFile("testdata/all-panels.json")
		textOptionsContent := helper.LoadFile("testdata/text-options.json")
		timelineDemoContent := helper.LoadFile("testdata/timeline-demo.json")

		// Modify UIDs to be unique for ResourceRef tests
		allPanelsModified := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "resourceref1"`, 1)
		textOptionsModified := strings.Replace(string(textOptionsContent), `"uid": "WZ7AhQiVz"`, `"uid": "resourceref2"`, 1)
		timelineDemoModified := strings.Replace(string(timelineDemoContent), `"uid": "mIJjFy8Kz"`, `"uid": "resourceref3"`, 1)

		// Create temporary files and copy them to the provisioning path
		tmpDir := t.TempDir()
		tmpFile1 := filepath.Join(tmpDir, "resource-test-1.json")
		tmpFile2 := filepath.Join(tmpDir, "resource-test-2.json")
		tmpFile3 := filepath.Join(tmpDir, "resource-test-3.json")

		require.NoError(t, os.WriteFile(tmpFile1, []byte(allPanelsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile2, []byte(textOptionsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile3, []byte(timelineDemoModified), 0644))

		// Copy the temporary files to the provisioning path
		helper.CopyToProvisioningPath(t, tmpFile1, "resource-test-1.json")        // UID: resourceref1
		helper.CopyToProvisioningPath(t, tmpFile2, "resource-test-2.json")        // UID: resourceref2
		helper.CopyToProvisioningPath(t, tmpFile3, "nested/resource-test-3.json") // UID: resourceref3

		// Trigger sync to populate the new resources
		helper.SyncAndWait(t, repo, nil)

		// Verify the new resources are created
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(dashboards.Items), 3, "should have at least 3 dashboards after adding test resources")

		// Debug: print the actual dashboard names/UIDs to verify they match our expectations
		for i, dashboard := range dashboards.Items {
			t.Logf("Dashboard %d: name=%s, UID=%s", i+1, dashboard.GetName(), dashboard.GetUID())
		}

		t.Run("delete single dashboard by resource reference", func(t *testing.T) {
			// Create delete job for single dashboard using ResourceRef
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
					Delete: &provisioning.DeleteJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name:  "resourceref1", // UID from modified all-panels.json
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create delete job with ResourceRef")

			// Wait for job to complete
			helper.AwaitJobs(t, repo)

			// Verify corresponding file is deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "resource-test-1.json")
			require.Error(t, err, "file should be deleted from repository")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify dashboard is removed from Grafana (check count like other successful tests)
			dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Equal(t, 2, len(dashboards.Items), "should have 2 dashboards after deleting 1 from 3")

			// Verify other resources still exist
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "resource-test-2.json")
			require.NoError(t, err, "other files should still exist")
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "nested", "resource-test-3.json")
			require.NoError(t, err, "nested files should still exist")
		})

		t.Run("delete multiple resources by reference", func(t *testing.T) {
			// Create delete job for multiple resources using ResourceRef
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
					Delete: &provisioning.DeleteJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name:  "resourceref2", // UID from modified text-options.json
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
							{
								Name:  "resourceref3", // UID from modified timeline-demo.json
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create delete job with multiple ResourceRefs")

			// Wait for job to complete
			helper.AwaitJobs(t, repo)

			// Verify both dashboards are removed from Grafana
			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref2", metav1.GetOptions{})
			require.Error(t, err, "text-options dashboard should be deleted")
			require.True(t, apierrors.IsNotFound(err))

			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref3", metav1.GetOptions{})
			require.Error(t, err, "timeline-demo dashboard should be deleted")
			require.True(t, apierrors.IsNotFound(err))

			// Verify corresponding files are deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "resource-test-2.json")
			require.Error(t, err, "resource-test-2.json should be deleted")

			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "nested", "resource-test-3.json")
			require.Error(t, err, "nested/resource-test-3.json should be deleted")

			// Verify specific dashboards are removed from Grafana
			dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Equal(t, 0, len(dashboards.Items), "should have 0 dashboards after deleting 2 more (2 -> 0)")
		})

		t.Run("mixed deletion - paths and resources", func(t *testing.T) {
			// Setup fresh resources for mixed test - reuse the modified content with unique UIDs
			tmpMixed1 := filepath.Join(tmpDir, "mixed-test-1.json")
			tmpMixed2 := filepath.Join(tmpDir, "mixed-test-2.json")
			tmpMixed3 := filepath.Join(tmpDir, "mixed-test-3.json")

			require.NoError(t, os.WriteFile(tmpMixed1, []byte(allPanelsModified), 0644))
			require.NoError(t, os.WriteFile(tmpMixed2, []byte(textOptionsModified), 0644))
			require.NoError(t, os.WriteFile(tmpMixed3, []byte(timelineDemoModified), 0644))

			helper.CopyToProvisioningPath(t, tmpMixed1, "mixed-test-1.json") // UID: resourceref1
			helper.CopyToProvisioningPath(t, tmpMixed2, "mixed-test-2.json") // UID: resourceref2
			helper.CopyToProvisioningPath(t, tmpMixed3, "mixed-test-3.json") // UID: resourceref3

			helper.SyncAndWait(t, repo, nil)

			// Create delete job that combines both paths and resource references
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
					Delete: &provisioning.DeleteJobOptions{
						Paths: []string{"mixed-test-1.json"}, // Delete by path
						Resources: []provisioning.ResourceRef{
							{
								Name:  "resourceref2", // Delete by resource reference
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create mixed delete job")

			// Wait for job to complete
			helper.AwaitJobs(t, repo)

			// Verify both targeted resources are deleted from Grafana
			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref1", metav1.GetOptions{})
			require.Error(t, err, "dashboard deleted by path should be removed")

			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref2", metav1.GetOptions{})
			require.Error(t, err, "dashboard deleted by resource ref should be removed")

			// Verify the untargeted resource still exists
			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref3", metav1.GetOptions{})
			require.NoError(t, err, "untargeted dashboard should still exist")

			// Verify files are properly deleted/preserved in repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "mixed-test-1.json")
			require.Error(t, err, "file deleted by path should be removed")

			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "mixed-test-2.json")
			require.Error(t, err, "file for resource deleted by ref should be removed")

			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "mixed-test-3.json")
			require.NoError(t, err, "untargeted file should still exist")
		})

		t.Run("delete folder by resource reference", func(t *testing.T) {
			// Create a dashboard inside a folder to automatically create the folder structure
			// This follows the same pattern as other tests in this file
			testDashboard := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "folder-dash"`, 1)

			// Write the modified dashboard to a temporary file first
			tmpFolderDash := filepath.Join(tmpDir, "folder-dashboard.json")
			require.NoError(t, os.WriteFile(tmpFolderDash, []byte(testDashboard), 0644))

			// Copy it to the folder structure using the helper
			helper.CopyToProvisioningPath(t, tmpFolderDash, "test-folder/dashboard-in-folder.json")

			// Sync to create the folder and its contents
			helper.SyncAndWait(t, repo, nil)

			// Verify folder was created in Grafana as a Folder resource
			folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)

			var testFolder *unstructured.Unstructured
			for _, folder := range folders.Items {
				// Folder names are generated with suffixes, so check if it starts with "test-folder"
				if strings.HasPrefix(folder.GetName(), "test-folder") {
					testFolder = &folder
					break
				}
			}
			require.NotNil(t, testFolder, "test-folder should exist as a Folder resource")
			testFolderName := testFolder.GetName()

			// Verify dashboard inside the folder exists
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "test-folder", "dashboard-in-folder.json")
			require.NoError(t, err, "dashboard inside folder should exist")

			// Create delete job for the folder using ResourceRef (use the actual generated name)
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
					Delete: &provisioning.DeleteJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name:  testFolderName, // Use the actual generated folder name
								Kind:  "Folder",
								Group: "folder.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create delete job for folder")

			// Wait for job to complete
			helper.AwaitJobs(t, repo)

			// Verify folder is deleted from Grafana
			_, err = helper.Folders.Resource.Get(ctx, testFolderName, metav1.GetOptions{})
			require.Error(t, err, "folder should be deleted from Grafana")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify folder contents are also deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "test-folder", "dashboard-in-folder.json")
			require.Error(t, err, "dashboard inside deleted folder should also be deleted")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")
		})

		t.Run("delete non-existent resource by reference", func(t *testing.T) {
			// Create delete job for non-existent resource
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionDelete,
					Delete: &provisioning.DeleteJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name:  "non-existent-uid",
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create delete job")

			// Wait for job to complete - should record error but continue
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				list := &unstructured.UnstructuredList{}
				err := helper.AdminREST.Get().
					Namespace("default").
					Resource("repositories").
					Name(repo).
					SubResource("jobs").
					Do(ctx).Into(list)
				assert.NoError(collect, err, "should be able to list jobs")
				assert.NotEmpty(collect, list.Items, "expect at least one job")

				// Find the most recent delete job
				var deleteJob *unstructured.Unstructured
				for _, elem := range list.Items {
					assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

					action := mustNestedString(elem.Object, "spec", "action")
					if action == "delete" {
						// Get the most recent one (they should be ordered by creation time)
						deleteJob = &elem
					}
				}
				if !assert.NotNil(collect, deleteJob, "should find a delete job") {
					return
				}

				state := mustNestedString(deleteJob.Object, "status", "state")
				// The job should complete but record errors for individual resource resolution failures
				if state == "error" || state == "completed" || state == "success" {
					// Any of these states is acceptable - the key is that resource resolution errors are recorded
					// and don't fail the entire job due to error-tolerant implementation
					return
				}
				assert.Fail(collect, "job should complete or error, but got state: %s", state)
			}, time.Second*10, time.Millisecond*100, "Expected delete job to handle non-existent resource")
		})

		// Repository cleanup is handled by the main test function
	})

	t.Run("delete non-existent file", func(t *testing.T) {
		// Create delete job for non-existent file
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Paths: []string{"non-existent.json"},
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create delete job")

		// Wait for job to complete - should fail due to strict error handling
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list := &unstructured.UnstructuredList{}
			err := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Do(ctx).Into(list)
			assert.NoError(collect, err, "should be able to list jobs")
			assert.NotEmpty(collect, list.Items, "expect at least one job")

			// Find the delete job specifically
			var deleteJob *unstructured.Unstructured
			for _, elem := range list.Items {
				assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

				action := mustNestedString(elem.Object, "spec", "action")
				if action == "delete" {
					deleteJob = &elem
					break
				}
			}
			assert.NotNil(collect, deleteJob, "should find a delete job")

			state := mustNestedString(deleteJob.Object, "status", "state")
			assert.Equal(collect, "error", state, "delete job should have failed due to non-existent file")
		}, time.Second*10, time.Millisecond*100, "Expected delete job to fail with error state")
	})
}

func TestIntegrationProvisioning_MoveJob(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()
	const repo = "move-test-repo"
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
		"SyncTarget":  "instance",
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)
	// Copy multiple test files to the repository
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "dashboard1.json")
	helper.CopyToProvisioningPath(t, "testdata/text-options.json", "dashboard2.json")
	helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "folder/dashboard3.json")
	// Trigger and wait for initial sync to populate resources
	helper.SyncAndWait(t, repo, nil)
	// Verify initial state - should have 3 dashboards and 1 folder
	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 3, len(dashboards.Items), "should have 3 dashboards after sync")
	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, len(folders.Items), "should have 1 folder after sync")

	t.Run("move single file", func(t *testing.T) {
		// Create move job for single file
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths:      []string{"dashboard1.json"},
					TargetPath: "moved/",
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		raw, err := result.Raw()
		require.NoError(t, err)

		obj := &unstructured.Unstructured{}
		err = json.Unmarshal(raw, obj)
		require.NoError(t, err)

		// Wait for job to complete
		helper.AwaitJobSuccess(t, ctx, obj)

		// TODO: This additional sync should not be necessary - the move job should handle sync properly
		helper.SyncAndWait(t, repo, nil)

		// Verify file is moved in repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "dashboard1.json")
		require.NoError(t, err, "file should exist at new location in repository")

		// Verify original file is gone from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.Error(t, err, "original file should be gone from repository")
		require.True(t, apierrors.IsNotFound(err), "should be not found error")

		// Verify dashboard still exists in Grafana after sync
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 3, "should still have 3 dashboards after move")

		// Verify that dashboards have the correct source paths
		foundPaths := make(map[string]bool)
		for _, dashboard := range dashboards.Items {
			sourcePath := dashboard.GetAnnotations()["grafana.app/sourcePath"]
			foundPaths[sourcePath] = true
		}

		require.True(t, foundPaths["moved/dashboard1.json"], "should have dashboard with moved source path")
		require.True(t, foundPaths["dashboard2.json"], "should have dashboard2 in original location")
		require.True(t, foundPaths["folder/dashboard3.json"], "should have dashboard3 in original nested location")

		// Verify other files still exist at original locations
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.NoError(t, err, "other files should still exist")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.NoError(t, err, "nested files should still exist")
	})

	t.Run("move multiple files and folder", func(t *testing.T) {
		// Create move job for multiple files including a folder
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths:      []string{"dashboard2.json", "folder/"},
					TargetPath: "archived/",
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		raw, err := result.Raw()
		require.NoError(t, err)
		obj := &unstructured.Unstructured{}
		err = json.Unmarshal(raw, obj)
		require.NoError(t, err)

		// Wait for job to complete
		helper.AwaitJobSuccess(t, ctx, obj)

		// TODO: This additional sync should not be necessary - the move job should handle sync properly
		helper.SyncAndWait(t, repo, nil)

		// Verify files are moved in repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "archived", "dashboard2.json")
		require.NoError(t, err, "dashboard2.json should exist at new location")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "archived", "folder", "dashboard3.json")
		require.NoError(t, err, "folder/dashboard3.json should exist at new nested location")

		// Verify original files are gone from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.Error(t, err, "dashboard2.json should be gone from original location")
		require.True(t, apierrors.IsNotFound(err))

		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.Error(t, err, "folder should be gone from original location")
		require.True(t, apierrors.IsNotFound(err), err.Error())

		// Verify dashboards still exist in Grafana after sync
		// Note: Since dashboard1.json was moved in the previous test, we now expect all 3 dashboards
		// to be accessible from their moved locations (dashboard1 from moved/, dashboard2 and dashboard3 from archived/)
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 3, "should still have 3 dashboards after move")

		// Verify that dashboards have the correct source paths after cumulative moves
		foundPaths := make(map[string]bool)
		for _, dashboard := range dashboards.Items {
			sourcePath := dashboard.GetAnnotations()["grafana.app/sourcePath"]
			foundPaths[sourcePath] = true
		}

		require.True(t, foundPaths["moved/dashboard1.json"], "should have dashboard1 from first move")
		require.True(t, foundPaths["archived/dashboard2.json"], "should have dashboard2 in archived location")
		require.True(t, foundPaths["archived/folder/dashboard3.json"], "should have dashboard3 in archived nested location")
	})

	t.Run("move non-existent file", func(t *testing.T) {
		// Create move job for non-existent file
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths:      []string{"non-existent.json"},
					TargetPath: "moved/",
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		// Wait for job to complete - should fail due to strict error handling
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list := &unstructured.UnstructuredList{}
			err := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Do(ctx).Into(list)
			assert.NoError(collect, err, "should be able to list jobs")
			assert.NotEmpty(collect, list.Items, "expect at least one job")

			// Find the move job specifically
			var moveJob *unstructured.Unstructured
			for _, elem := range list.Items {
				assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

				action := mustNestedString(elem.Object, "spec", "action")
				if action == "move" {
					// Check if this is the specific job we're looking for
					paths, found, err := unstructured.NestedStringSlice(elem.Object, "spec", "move", "paths")
					if err == nil && found && len(paths) > 0 && paths[0] == "non-existent.json" {
						moveJob = &elem
						break
					}
				}
			}
			assert.NotNil(collect, moveJob, "should find a move job for non-existent file")

			state := mustNestedString(moveJob.Object, "status", "state")
			assert.Equal(collect, "error", state, "move job should have failed due to non-existent file")
		}, time.Second*10, time.Millisecond*100, "Expected move job to fail with error state")
	})

	t.Run("move without target path", func(t *testing.T) {
		// Create move job without target path (should fail)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths: []string{"moved/dashboard1.json"},
					// TargetPath intentionally omitted
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		// Wait for job to complete - should fail due to missing target path
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list := &unstructured.UnstructuredList{}
			err := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Do(ctx).Into(list)
			assert.NoError(collect, err, "should be able to list jobs")
			assert.NotEmpty(collect, list.Items, "expect at least one job")

			// Find the move job specifically
			var moveJob *unstructured.Unstructured
			for _, elem := range list.Items {
				assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

				action := mustNestedString(elem.Object, "spec", "action")
				if action == "move" {
					// Check if this is the job without target path
					targetPath, found, _ := unstructured.NestedString(elem.Object, "spec", "move", "targetPath")
					if !found || targetPath == "" {
						moveJob = &elem
						break
					}
				}
			}
			assert.NotNil(collect, moveJob, "should find a move job without target path")

			state := mustNestedString(moveJob.Object, "status", "state")
			assert.Equal(collect, "error", state, "move job should have failed due to missing target path")
		}, time.Second*10, time.Millisecond*100, "Expected move job to fail with error state")
	})

	t.Run("move by resource reference", func(t *testing.T) {
		// Create a unique repository for resource reference testing to avoid contamination
		const refRepo = "move-ref-test-repo"
		localRefTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        refRepo,
			"SyncEnabled": true,
			"SyncTarget":  "folder",
		})
		_, err := helper.Repositories.Resource.Create(ctx, localRefTmp, metav1.CreateOptions{})
		require.NoError(t, err)

		// Create modified test files with unique UIDs for ResourceRef testing
		allPanelsContent := helper.LoadFile("testdata/all-panels.json")
		textOptionsContent := helper.LoadFile("testdata/text-options.json")
		timelineDemoContent := helper.LoadFile("testdata/timeline-demo.json")

		// Modify UIDs to be unique for ResourceRef tests
		allPanelsModified := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "moveref1"`, 1)
		textOptionsModified := strings.Replace(string(textOptionsContent), `"uid": "WZ7AhQiVz"`, `"uid": "moveref2"`, 1)
		timelineDemoModified := strings.Replace(string(timelineDemoContent), `"uid": "mIJjFy8Kz"`, `"uid": "moveref3"`, 1)

		// Create temporary files and copy them to the provisioning path
		tmpDir := t.TempDir()
		tmpFile1 := filepath.Join(tmpDir, "move-ref-test-1.json")
		tmpFile2 := filepath.Join(tmpDir, "move-ref-test-2.json")
		tmpFile3 := filepath.Join(tmpDir, "move-ref-test-3.json")

		require.NoError(t, os.WriteFile(tmpFile1, []byte(allPanelsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile2, []byte(textOptionsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile3, []byte(timelineDemoModified), 0644))

		// Copy files to provisioning path to set up test - use refRepo's path
		helper.CopyToProvisioningPath(t, tmpFile1, "move-source-1.json")
		helper.CopyToProvisioningPath(t, tmpFile2, "move-source-2.json")
		helper.CopyToProvisioningPath(t, tmpFile3, "move-source-3.json")

		// Sync to populate resources in Grafana
		helper.SyncAndWait(t, refRepo, nil)

		t.Run("move single dashboard by resource reference", func(t *testing.T) {
			// Create move job for single dashboard using ResourceRef
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(refRepo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionMove,
					Move: &provisioning.MoveJobOptions{
						TargetPath: "moved-by-ref/",
						Resources: []provisioning.ResourceRef{
							{
								Name:  "moveref1", // UID from modified all-panels.json
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create move job with ResourceRef")

			// Wait for job to complete
			helper.AwaitJobs(t, refRepo)

			// Verify corresponding file is moved in repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "moved-by-ref", "move-source-1.json")
			require.NoError(t, err, "file should be moved to new location in repository")

			// Verify original file is deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "move-source-1.json")
			require.Error(t, err, "original file should be deleted from repository")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify dashboard still exists in Grafana (should be updated after sync)
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(ctx, "moveref1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should still exist in Grafana after move")

			// Verify other resource still exists in original location
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "move-source-2.json")
			require.NoError(t, err, "other files should still exist in original location")
		})

		t.Run("move multiple resources by reference", func(t *testing.T) {
			// Create move job for remaining resource using ResourceRef
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(refRepo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionMove,
					Move: &provisioning.MoveJobOptions{
						TargetPath: "archived-by-ref/",
						Resources: []provisioning.ResourceRef{
							{
								Name:  "moveref2", // UID from modified text-options.json
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create move job with ResourceRef")

			// Wait for job to complete
			helper.AwaitJobs(t, refRepo)

			// Verify file is moved in repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "archived-by-ref", "move-source-2.json")
			require.NoError(t, err, "file should be moved to new location")

			// Verify original file is deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "move-source-2.json")
			require.Error(t, err, "original file should be deleted from repository")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify dashboard still exists in Grafana after sync
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(ctx, "moveref2", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should still exist in Grafana after move")
		})

		t.Run("mixed move - paths and resources", func(t *testing.T) {
			// Setup fresh resources for mixed test
			tmpMixed1 := filepath.Join(tmpDir, "mixed-move-1.json")
			tmpMixed2 := filepath.Join(tmpDir, "mixed-move-2.json")

			allPanelsMixed := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "mixedmove1"`, 1)
			textOptionsMixed := strings.Replace(string(textOptionsContent), `"uid": "WZ7AhQiVz"`, `"uid": "mixedmove2"`, 1)

			require.NoError(t, os.WriteFile(tmpMixed1, []byte(allPanelsMixed), 0644))
			require.NoError(t, os.WriteFile(tmpMixed2, []byte(textOptionsMixed), 0644))

			helper.CopyToProvisioningPath(t, tmpMixed1, "mixed-move-1.json") // UID: mixedmove1
			helper.CopyToProvisioningPath(t, tmpMixed2, "mixed-move-2.json") // UID: mixedmove2

			helper.SyncAndWait(t, refRepo, nil)

			// Create move job that combines both paths and resource references
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(refRepo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
					Action: provisioning.JobActionMove,
					Move: &provisioning.MoveJobOptions{
						TargetPath: "mixed-target/",
						Paths:      []string{"mixed-move-1.json"}, // Move by path
						Resources: []provisioning.ResourceRef{
							{
								Name:  "mixedmove2", // Move by resource reference
								Kind:  "Dashboard",
								Group: "dashboard.grafana.app",
							},
						},
					},
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create mixed move job")

			// Wait for job to complete
			helper.AwaitJobs(t, refRepo)

			// Verify both targeted resources are moved in repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-target", "mixed-move-1.json")
			require.NoError(t, err, "file moved by path should exist at new location")

			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-target", "mixed-move-2.json")
			require.NoError(t, err, "file moved by resource ref should exist at new location")

			// Verify files are deleted from original locations
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-move-1.json")
			require.Error(t, err, "file moved by path should be deleted from original location")

			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-move-2.json")
			require.Error(t, err, "file moved by resource ref should be deleted from original location")

			// Verify dashboards still exist in Grafana after sync
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(ctx, "mixedmove1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard moved by path should still exist in Grafana")

			_, err = helper.DashboardsV1.Resource.Get(ctx, "mixedmove2", metav1.GetOptions{})
			require.NoError(t, err, "dashboard moved by resource ref should still exist in Grafana")
		})
	})
}

func TestIntegrationProvisioning_MoveResources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()
	const repo = "move-test-repo"
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
		"SyncTarget":  "instance",
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Copy test dashboards to the repository path for initial setup
	const originalDashboard = "all-panels.json"
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", originalDashboard)

	// Wait for sync to ensure the dashboard is created in Grafana
	helper.SyncAndWait(t, repo, nil)

	// Verify the original dashboard exists in Grafana (using the UID from all-panels.json)
	const allPanelsUID = "n1jR8vnnz" // This is the UID from the all-panels.json file
	obj, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
	require.NoError(t, err, "original dashboard should exist in Grafana")
	require.Equal(t, repo, obj.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	t.Run("move file without content change", func(t *testing.T) {
		const targetPath = "moved/simple-move.json"

		// Perform the move operation using helper function
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: originalDashboard,
			message:      "move file without content change",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move operation should succeed")

		// Verify the file moved in the repository
		movedObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "simple-move.json")
		require.NoError(t, err, "moved file should exist in repository")

		// Check the content is preserved (verify it's still the all-panels dashboard)
		resource, _, err := unstructured.NestedMap(movedObj.Object, "resource")
		require.NoError(t, err)
		dryRun, _, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		title, _, err := unstructured.NestedString(dryRun, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Panel tests - All panels", title, "content should be preserved")

		// Verify original file no longer exists
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", originalDashboard)
		require.Error(t, err, "original file should no longer exist")

		// Verify dashboard still exists in Grafana with same content but may have updated path references
		helper.SyncAndWait(t, repo, nil)
		_, err = helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "dashboard should still exist in Grafana after move")
	})

	t.Run("move file to nested path without ref", func(t *testing.T) {
		// Test a different scenario: Move a file that was never synced to Grafana
		// This might reveal the issue if dashboard creation fails during move
		const sourceFile = "never-synced.json"
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", sourceFile)

		// DO NOT sync - move the file immediately without it ever being in Grafana
		const targetPath = "deep/nested/timeline.json"

		// Perform the move operation without the file ever being synced to Grafana
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: sourceFile,
			message:      "move never-synced file to nested path",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move operation should succeed")

		// Check folders were created and validate hierarchy
		folderList, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should be able to list folders")

		// Build a map of folder names to their objects for easier lookup
		folders := make(map[string]*unstructured.Unstructured)
		for _, folder := range folderList.Items {
			title, _, _ := unstructured.NestedString(folder.Object, "spec", "title")
			folders[title] = &folder
			parent, _, _ := unstructured.NestedString(folder.Object, "metadata", "annotations", "grafana.app/folder")
			t.Logf("  - %s: %s (parent: %s)", folder.GetName(), title, parent)
		}

		// Validate expected folders exist with proper hierarchy
		// Expected structure: deep -> deep/nested
		deepFolderTitle := "deep"
		nestedFolderTitle := "nested"

		// Validate "deep" folder exists and has no parent (is top-level)
		require.Contains(t, folders, deepFolderTitle, "deep folder should exist")
		f := folders[deepFolderTitle]
		deepFolderName := f.GetName()
		title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
		require.Equal(t, deepFolderTitle, title, "deep folder should have correct title")
		parent, found, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/folder")
		require.True(t, !found || parent == "", "deep folder should be top-level (no parent)")

		// Validate "deep/nested" folder exists and has "deep" as parent
		require.Contains(t, folders, nestedFolderTitle, "nested folder should exist")
		f = folders[nestedFolderTitle]
		nestedFolderName := f.GetName()
		title, _, _ = unstructured.NestedString(f.Object, "spec", "title")
		require.Equal(t, nestedFolderTitle, title, "nested folder should have correct title")
		parent, _, _ = unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, deepFolderName, parent, "nested folder should have deep folder as parent")

		// The key test: Check if dashboard was created in Grafana during move
		const timelineUID = "mIJjFy8Kz"
		dashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "dashboard should exist in Grafana after moving never-synced file")
		dashboardFolder, _, _ := unstructured.NestedString(dashboard.Object, "metadata", "annotations", "grafana.app/folder")

		// Validate dashboard is in the correct nested folder
		require.Equal(t, nestedFolderName, dashboardFolder, "dashboard should be in the nested folder")

		// Verify the file moved in the repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "deep", "nested", "timeline.json")
		require.NoError(t, err, "moved file should exist in nested repository path")

		// Verify the original file no longer exists in the repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", sourceFile)
		require.Error(t, err, "original file should no longer exist in repository")
	})

	t.Run("move file with content update", func(t *testing.T) {
		const sourcePath = "moved/simple-move.json" // Use the file from previous test
		const targetPath = "updated/content-updated.json"

		// Use text-options.json content for the update
		updatedContent := helper.LoadFile("testdata/text-options.json")

		// Perform move with content update using helper function
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: sourcePath,
			message:      "move file with content update",
			body:         string(updatedContent),
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move with content update should succeed")

		// Verify the moved file has updated content (should now be text-options dashboard)
		movedObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "updated", "content-updated.json")
		require.NoError(t, err, "moved file should exist in repository")

		resource, _, err := unstructured.NestedMap(movedObj.Object, "resource")
		require.NoError(t, err)
		dryRun, _, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		title, _, err := unstructured.NestedString(dryRun, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Text options", title, "content should be updated to text-options dashboard")

		// Check it has the expected UID from text-options.json
		name, _, err := unstructured.NestedString(dryRun, "metadata", "name")
		require.NoError(t, err)
		require.Equal(t, "WZ7AhQiVz", name, "should have the UID from text-options.json")

		// Verify source file no longer exists
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "simple-move.json")
		require.Error(t, err, "source file should no longer exist")

		// Sync and verify the updated dashboard exists in Grafana
		helper.SyncAndWait(t, repo, nil)
		const textOptionsUID = "WZ7AhQiVz" // UID from text-options.json
		updatedDashboard, err := helper.DashboardsV1.Resource.Get(ctx, textOptionsUID, metav1.GetOptions{})
		require.NoError(t, err, "updated dashboard should exist in Grafana")

		// Verify the original dashboard was deleted from Grafana
		_, err = helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.Error(t, err, "original dashboard should be deleted from Grafana")
		require.True(t, apierrors.IsNotFound(err))

		// Verify the new dashboard has the updated content
		updatedTitle, _, err := unstructured.NestedString(updatedDashboard.Object, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Text options", updatedTitle)
	})

	t.Run("move directory", func(t *testing.T) {
		// Create some files in a directory first using existing testdata files
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "source-dir/timeline-demo.json")
		helper.CopyToProvisioningPath(t, "testdata/text-options.json", "source-dir/text-options.json")

		// Sync to ensure files are recognized
		helper.SyncAndWait(t, repo, nil)

		const sourceDir = "source-dir/"
		const targetDir = "moved-dir/"

		// Move directory using helper function
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetDir,
			originalPath: sourceDir,
			message:      "move directory",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "directory move should succeed")

		// Verify source directory no longer exists
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "source-dir")
		require.Error(t, err, "source directory should no longer exist")

		// Verify target directory and files exist
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved-dir", "timeline-demo.json")
		require.NoError(t, err, "moved timeline-demo.json should exist")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved-dir", "text-options.json")
		require.NoError(t, err, "moved text-options.json should exist")
	})

	t.Run("error cases", func(t *testing.T) {
		t.Run("missing originalPath parameter", func(t *testing.T) {
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "target.json").
				Body([]byte(`{"test": "content"}`)).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.Error(t, result.Error(), "should fail without originalPath")
		})

		t.Run("file to directory type mismatch", func(t *testing.T) {
			// First create a simple test file without slashes in the path
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "simple-test.json").
				Body(helper.LoadFile("testdata/all-panels.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should create test file")

			// Now try to move this file to a directory path using helper function
			resp := helper.postFilesRequest(t, repo, filesPostOptions{
				targetPath:   "target-dir/",
				originalPath: "simple-test.json",
				message:      "test move",
			})
			// nolint:errcheck
			defer resp.Body.Close()
			// Read response body to check error message
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			require.NotEqual(t, http.StatusOK, resp.StatusCode, "should fail when moving file to directory")
			require.Contains(t, string(body), "cannot move between file and directory types")
		})

		t.Run("non-existent source file", func(t *testing.T) {
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "target.json").
				Param("originalPath", "non-existent.json").
				Body([]byte("")).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.Error(t, result.Error(), "should fail when source file doesn't exist")
		})
	})

	t.Run("move non-existent resource by reference", func(t *testing.T) {
		// Create move job for non-existent resource
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					TargetPath: "moved-nonexistent/",
					Resources: []provisioning.ResourceRef{
						{
							Name:  "non-existent-move-uid",
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		// Wait for job to complete - should record error but continue
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list := &unstructured.UnstructuredList{}
			err := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Do(ctx).Into(list)
			assert.NoError(collect, err, "should be able to list jobs")
			assert.NotEmpty(collect, list.Items, "expect at least one job")

			// Find the most recent move job
			var moveJob *unstructured.Unstructured
			for _, elem := range list.Items {
				assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

				action := mustNestedString(elem.Object, "spec", "action")
				if action == "move" {
					// Get the most recent one (they should be ordered by creation time)
					moveJob = &elem
				}
			}
			if !assert.NotNil(collect, moveJob, "should find a move job") {
				return
			}

			state := mustNestedString(moveJob.Object, "status", "state")
			// The job should complete but record errors for individual resource resolution failures
			if state == "error" || state == "completed" || state == "success" {
				// Any of these states is acceptable - the key is that resource resolution errors are recorded
				// and don't fail the entire job due to error-tolerant implementation
				return
			}
			assert.Fail(collect, "job should complete or error, but got state: %s", state)
		}, time.Second*10, time.Millisecond*100, "Expected move job to handle non-existent resource")
	})
}

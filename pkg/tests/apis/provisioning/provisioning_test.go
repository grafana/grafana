package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	gh "github.com/google/go-github/v70/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
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
			rsp = helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(name).
				Suffix("files/").
				Do(context.Background())
			require.NoError(t, rsp.Error())
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
	})

	t.Run("Repositories are reported in stats", func(t *testing.T) {
		report := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
			Method: http.MethodGet,
			Path:   "/api/admin/usage-report-preview",
			User:   helper.K8sTestHelper.Org1.Admin,
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

func TestIntegrationProvisioning_CreatingGitHubRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	helper.GetEnv().GitHubFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(ghmock.GetUser, ghAlwaysWrite(t, &gh.User{Name: gh.Ptr("github-user")})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepo, ghAlwaysWrite(t, []*gh.Hook{})),
		ghmock.WithRequestMatchHandler(ghmock.PostReposHooksByOwnerByRepo, ghAlwaysWrite(t, &gh.Hook{ID: gh.Ptr(int64(123))})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposByOwnerByRepo, ghAlwaysWrite(t, &gh.Repository{ID: gh.Ptr(int64(234))})),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposBranchesByOwnerByRepoByBranch,
			ghAlwaysWrite(t, &gh.Branch{
				Name:   gh.Ptr("main"),
				Commit: &gh.RepositoryCommit{SHA: gh.Ptr("deadbeef")},
			}),
		),
		ghmock.WithRequestMatchHandler(ghmock.GetReposGitTreesByOwnerByRepoByTreeSha,
			ghHandleTree(t, map[string][]*gh.TreeEntry{
				"deadbeef": {
					treeEntryDir("grafana", "subtree"),
				},
				"subtree": {
					treeEntry("dashboard.json", helper.LoadFile("testdata/all-panels.json")),
					treeEntryDir("subdir", "subtree2"),
					treeEntry("subdir/dashboard2.yaml", helper.LoadFile("testdata/text-options.json")),
				},
			})),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposContentsByOwnerByRepoByPath,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				pathRegex := regexp.MustCompile(`/repos/[^/]+/[^/]+/contents/(.*)`)
				matches := pathRegex.FindStringSubmatch(r.URL.Path)
				require.NotNil(t, matches, "no match for contents?")
				path := matches[1]

				var err error
				switch path {
				case "grafana/dashboard.json":
					_, err = w.Write(ghmock.MustMarshal(repoContent(path, helper.LoadFile("testdata/all-panels.json"))))
				case "grafana/subdir/dashboard2.yaml":
					_, err = w.Write(ghmock.MustMarshal(repoContent(path, helper.LoadFile("testdata/text-options.json"))))
				default:
					t.Fatalf("got unexpected path: %s", path)
				}
				require.NoError(t, err)
			}),
		),
	)

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

	found, err := helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	assert.Contains(t, names, "n1jR8vnnz", "should contain dashboard.json's contents")
	assert.Contains(t, names, "WZ7AhQiVz", "should contain dashboard2.yaml's contents")

	err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{})
	require.NoError(t, err, "should delete values")

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
		result := helper.AdminREST.Post().
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
		obj, err := helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
		require.NoError(t, err, "the value should be saved in grafana")
		val, _, _ := unstructured.NestedString(obj.Object, "metadata", "annotations", utils.AnnoKeyManagerKind)
		require.Equal(t, string(utils.ManagerKindRepo), val, "should have repo annotations")
		val, _, _ = unstructured.NestedString(obj.Object, "metadata", "annotations", utils.AnnoKeyManagerIdentity)
		require.Equal(t, repo, val, "should have repo annotations")

		// Read the file we wrote
		obj, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", targetPath)
		require.NoError(t, err, "read value")
		name, _, _ = unstructured.NestedString(obj.Object, "resource", "file", "metadata", "name")
		require.Equal(t, allPanels, name, "read the name out of the saved file")
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

	const repo = "local-tmp"
	// Set up the repository and the file to import.
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "all-panels.json")

	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Make sure the repo can read and validate the file
	obj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	resource, _, err := unstructured.NestedMap(obj.Object, "resource")
	require.NoError(t, err, "missing resource")
	action, _, err := unstructured.NestedString(resource, "action")
	require.NoError(t, err, "invalid action")

	require.NotNil(t, resource["file"], "the raw file")
	require.NotNil(t, resource["dryRun"], "dryRun result")
	require.Equal(t, "create", action)

	// But the dashboard shouldn't exist yet
	const allPanels = "n1jR8vnnz"
	_, err = helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "no all-panels dashboard should exist")
	require.True(t, apierrors.IsNotFound(err))

	// Now, we import it, such that it may exist
	helper.SyncAndWait(t, repo, nil)

	_, err = helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	obj, err = helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.NoError(t, err, "all-panels dashboard should exist")
	require.Equal(t, repo, obj.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	// Try writing the value directly
	err = unstructured.SetNestedField(obj.Object, []any{"aaa", "bbb"}, "spec", "tags")
	require.NoError(t, err, "set tags")
	_, err = helper.Dashboards.Resource.Update(ctx, obj, metav1.UpdateOptions{})
	require.Error(t, err, "only the provisionding service should be able to update")
	require.True(t, apierrors.IsForbidden(err))

	// Should not be able to directly delete the managed resource
	err = helper.Dashboards.Resource.Delete(ctx, allPanels, metav1.DeleteOptions{})
	require.Error(t, err, "only the provisioning service should be able to delete")
	require.True(t, apierrors.IsForbidden(err))

	// But we can delete the repository file, and this should also remove the resource
	err = helper.Repositories.Resource.Delete(ctx, repo, metav1.DeleteOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "should delete the resource file")

	_, err = helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "should delete the internal resource")
	require.True(t, apierrors.IsNotFound(err))
}

func TestProvisioning_ExportUnifiedToRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Set up dashboards first, then the repository, and finally export.
	dashboard := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/root_dashboard.json")
	_, err := helper.Dashboards.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create prerequisite dashboard")

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

	fpath := filepath.Join(helper.ProvisioningPath, slugify.Slugify(mustNestedString(dashboard.Object, "spec", "title"))+".json")
	_, err = os.Stat(fpath)
	require.NoError(t, err, "exported file was not created at path %s", fpath)
}

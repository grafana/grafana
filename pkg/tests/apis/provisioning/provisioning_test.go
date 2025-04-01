package provisioning

import (
	"context"
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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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
	_, err := helper.Repositories.Resource.Update(ctx,
		helper.RenderObject(t, "testdata/github-readonly.json.tmpl", map[string]any{
			"Name":        repo,
			"SyncEnabled": true,
			"SyncTarget":  "instance",
			"Path":        "grafana/",
		}),
		metav1.UpdateOptions{},
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
}

func TestIntegrationProvisioning_SafePathUsages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "local-safe-path-usages"
	// Set up the repository.
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{"Name": repo})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Write a file
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "all-panels.json").
		Body(helper.LoadFile("testdata/all-panels.json")).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "expecting to be able to create file")

	// Write a file with a bad path
	result = helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", "test", "..", "..", "all-panels.json").
		Body(helper.LoadFile("testdata/all-panels.json")).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.Error(t, result.Error(), "invalid path should return error")

	// Read a file
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	// Read a file with a bad path
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "../../all-panels.json")
	require.Error(t, err, "invalid path should not be fine")
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

	localTmp := helper.RenderObject(t, "testdata/local-readonly.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)

	// Make sure the repo can see the file
	_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
	require.NoError(t, err, "valid path should be fine")

	// But the dashboard shouldn't exist yet
	const allPanels = "n1jR8vnnz"
	_, err = helper.Dashboards.Resource.Get(ctx, allPanels, metav1.GetOptions{})
	require.Error(t, err, "no all-panels dashboard should exist")

	// Now, we import it, such that it may exist
	helper.SyncAndWait(t, repo, nil)

	found, err := helper.Dashboards.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "can list values")

	names := []string{}
	for _, v := range found.Items {
		names = append(names, v.GetName())
	}
	require.Contains(t, names, allPanels, "all-panels dashboard should now exist")
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
				Folder:     "",   // export entire instance
				Path:       "",   // no prefix necessary for testing
				Identifier: true, // doesn't _really_ matter, but handy for debugging.
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

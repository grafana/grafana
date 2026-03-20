package common

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"text/template"
	"time"

	"github.com/google/go-github/v82/github"
	"github.com/grafana/nanogit/gittest"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardsV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardsV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	githubConnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const (
	WaitTimeoutDefault  = 30 * time.Second
	WaitIntervalDefault = 100 * time.Millisecond
)

//nolint:gosec // Test RSA private key (generated for testing purposes only, never used in production)
const TestGithubPrivateKeyPEM = "-----BEGIN RSA PRIVATE KEY-----\n" + // trufflehog:ignore
	`MIIEoQIBAAKCAQBn1MuM5hIfH6d3TNStI1ofWv/gcjQ4joi9cFijEwVLuPYkF1nD
KkSbaMGFUWiOTaB/H9fxmd/V2u04NlBY3av6m5T/sHfVSiEWAEUblh3cA34HVCmD
cqyyVty5HLGJJlSs2C7W2x7yUc9ImzyDBsyjpKOXuojJ9wN9a17D2cYU5WkXjoDC
4BHid61jn9WBTtPZXSgOdirwahNzxZQSIP7DA9T8yiZwIWPp5YesgsAPyQLCFPgM
s77xz/CEUnEYQ35zI/k/mQrwKdQ/ZP8xLwQohUID0BIxE7G5quL069RuuCZWZkoF
oPiZbp7HSryz1+19jD3rFT7eHGUYvAyCnXmXAgMBAAECggEADSs4Bc7ITZo+Kytb
bfol3AQ2n8jcRrANN7mgBE7NRSVYUouDnvUlbnCC2t3QXPwLdxQa11GkygLSQ2bg
GeVDgq1o4GUJTcvxFlFCcpU/hEANI/DQsxNAQ/4wUGoLOlHaO3HPvwBblHA70gGe
Ux/xpG+lMAFAiB0EHEwZ4M0mClBEOQv3NzaFTWuBHtIMS8eid7M1q5qz9+rCgZSL
KBBHo0OvUbajG4CWl8SM6LUYapASGg+U17E+4xA3npwpIdsk+CbtX+vvX324n4kn
0EkrJqCjv8M1KiCKAP+UxwP00ywxOg4PN+x+dHI/I7xBvEKe/x6BltVSdGA+PlUK
02wagQKBgQDF7gdQLFIagPH7X7dBP6qEGxj/Ck9Qdz3S1gotPkVeq+1/UtQijYZ1
j44up/0yB2B9P4kW091n+iWcyfoU5UwBua9dHvCZP3QH05LR1ZscUHxLGjDPBASt
l2xSq0hqqNWBspb1M0eCY0Yxi65iDkj3xsI2iN35BEb1FlWdR5KGvwKBgQCGS0ce
wASWbZIPU2UoKGOQkIJU6QmLy0KZbfYkpyfE8IxGttYVEQ8puNvDDNZWHNf+LP85
c8iV6SfnWiLmu1XkG2YmJFBCCAWgJ8Mq2XQD8E+a/xcaW3NqlcC5+I2czX367j3r
69wZSxRbzR+DCfOiIkrekJImwN183ZYy2cBbKQKBgFj86IrSMmO6H5Ft+j06u5ZD
fJyF7Rz3T3NwSgkHWzbyQ4ggHEIgsRg/36P4YSzSBj6phyAdRwkNfUWdxXMJmH+a
FU7frzqnPaqbJAJ1cBRt10QI1XLtkpDdaJVObvONTtjOC3LYiEkGCzQRYeiyFXpZ
AU51gJ8JnkFotjtNR4KPAoGAehVREDlLcl0lnN0ZZspgyPk2Im6/iOA9KTH3xBZZ
ZwWu4FIyiHA7spgk4Ep5R0ttZ9oMI3SIcw/EgONGOy8uw/HMiPwWIhEc3B2JpRiO
CU6bb7JalFFyuQBudiHoyxVcY5PVovWF31CLr3DoJr4TR9+Y5H/U/XnzYCIo+w1N
exECgYBFAGKYTIeGAvhIvD5TphLpbCyeVLBIq5hRyrdRY+6Iwqdr5PGvLPKwin5+
+4CDhWPW4spq8MYPCRiMrvRSctKt/7FhVGL2vE/0VY3TcLk14qLC+2+0lnPVgnYn
u5/wOyuHp1cIBnjeN41/pluOWFBHI9xLW3ExLtmYMiecJ8VdRA==
-----END RSA PRIVATE KEY-----`

type ProvisioningTestHelper struct {
	*apis.K8sTestHelper
	ProvisioningPath string

	Repositories       *apis.K8sResourceClient
	Connections        *apis.K8sResourceClient
	Jobs               *apis.K8sResourceClient
	Folders            *apis.K8sResourceClient
	DashboardsV0       *apis.K8sResourceClient
	DashboardsV1       *apis.K8sResourceClient
	DashboardsV2alpha1 *apis.K8sResourceClient
	DashboardsV2beta1  *apis.K8sResourceClient
	AdminREST          *rest.RESTClient
	EditorREST         *rest.RESTClient
	ViewerREST         *rest.RESTClient
}

func (h *ProvisioningTestHelper) SyncAndWait(t *testing.T, repo string, options *provisioning.SyncJobOptions) {
	t.Helper()

	if options == nil {
		options = &provisioning.SyncJobOptions{}
	}
	body := AsJSON(&provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   options,
	})

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	if apierrors.IsAlreadyExists(result.Error()) {
		// Wait for all jobs to finish as we don't have the name.
		h.AwaitJobs(t, repo)
		return
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")
	h.AwaitJobs(t, repo)
}

func (h *ProvisioningTestHelper) TriggerJobAndWaitForSuccess(t *testing.T, repo string, spec provisioning.JobSpec) {
	t.Helper()

	body := AsJSON(spec)
	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	if apierrors.IsAlreadyExists(result.Error()) {
		// Wait for all jobs to finish as we don't have the name.
		h.AwaitJobs(t, repo)
		return
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")
	h.AwaitJobSuccess(t, t.Context(), unstruct)
}

func (h *ProvisioningTestHelper) TriggerJobAndWaitForComplete(t *testing.T, repo string, spec provisioning.JobSpec) *unstructured.Unstructured {
	t.Helper()

	body := AsJSON(spec)
	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	if apierrors.IsAlreadyExists(result.Error()) {
		// A job is already in-flight. Wait and return the latest historic job.
		t.Logf("job already running for repo %q; waiting for it to complete", repo)
		return h.AwaitLatestHistoricJob(t, repo)
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")

	return h.AwaitJob(t, t.Context(), unstruct)
}

// AwaitLatestHistoricJob waits for the repo's queue to empty and returns the most recent historic job.
func (h *ProvisioningTestHelper) AwaitLatestHistoricJob(t *testing.T, repo string) *unstructured.Unstructured {
	t.Helper()
	// Wait until no active jobs for this repo
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list active jobs") {
			return
		}
		for _, elem := range list.Items {
			r, _, err := unstructured.NestedString(elem.Object, "spec", "repository")
			if !assert.NoError(collect, err) {
				return
			}
			if r == repo {
				collect.Errorf("still have active job %q for repo %q", elem.GetName(), repo)
				return
			}
		}
	}, WaitTimeoutDefault, WaitIntervalDefault, "job queue must be empty before reading historic jobs")

	// Fetch historic jobs and pick the newest by creationTimestamp
	result, err := h.Repositories.Resource.Get(context.Background(), repo, metav1.GetOptions{}, "jobs")
	require.NoError(t, err, "failed to list historic jobs")
	list, err := result.ToList()
	require.NoError(t, err, "results should be a list")
	require.NotEmpty(t, list.Items, "expect at least one historic job")

	latest := list.Items[0]
	for i := 1; i < len(list.Items); i++ {
		if list.Items[i].GetCreationTimestamp().After(latest.GetCreationTimestamp().Time) {
			latest = list.Items[i]
		}
	}
	return latest.DeepCopy()
}

func (h *ProvisioningTestHelper) AwaitJobSuccess(t *testing.T, ctx context.Context, job *unstructured.Unstructured) {
	t.Helper()
	job = h.AwaitJob(t, ctx, job)
	lastErrors := MustNestedStringSlice(job.Object, "status", "errors")
	lastState := MustNestedString(job.Object, "status", "state")

	repo := job.GetLabels()[jobs.LabelRepository]

	// Debug state if job failed
	if len(lastErrors) > 0 || lastState != string(provisioning.JobStateSuccess) {
		h.DebugState(t, repo, fmt.Sprintf("JOB FAILED: %s", job.GetName()))
	}

	require.Empty(t, lastErrors, "historic job '%s' has errors: %v", job.GetName(), lastErrors)
	require.Equal(t, string(provisioning.JobStateSuccess), lastState,
		"historic job '%s' was not successful", job.GetName())
}

func (h *ProvisioningTestHelper) AwaitJob(t *testing.T, ctx context.Context, job *unstructured.Unstructured) *unstructured.Unstructured {
	t.Helper()

	repo := job.GetLabels()[jobs.LabelRepository]
	require.NotEmpty(t, repo)

	var lastResult *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := h.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{},
			"jobs", string(job.GetUID()))

		if !assert.False(collect, apierrors.IsNotFound(err)) {
			collect.Errorf("job '%s' not found, still waiting for it to complete", job.GetName())
			return
		}

		assert.NoError(collect, err, "failed to get job '%s' to be found", job.GetName())
		if err != nil {
			return
		}

		lastResult = result
	}, WaitTimeoutDefault, WaitIntervalDefault)
	require.NotNil(t, lastResult, "expected job result to be non-nil")

	return lastResult
}

func (h *ProvisioningTestHelper) AwaitJobs(t *testing.T, repoName string) {
	t.Helper()

	// First, we wait for all current jobs for the repository to disappear (i.e. complete/fail).
	j, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list active jobs")

	waitUntilComplete := map[string]bool{}
	for _, item := range j.Items {
		annotations := item.GetLabels()
		if annotations[jobs.LabelRepository] == repoName {
			waitUntilComplete[item.GetName()] = false
		}
	}

	// if no active jobs for this repo, queue a pull job as a failsafe to try to ensure we are up to date as much as possible
	if len(waitUntilComplete) == 0 {
		body := AsJSON(&provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		h.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(context.Background())

		j, err = h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err, "failed to list active jobs")

		for _, item := range j.Items {
			annotations := item.GetLabels()
			if annotations[jobs.LabelRepository] == repoName {
				waitUntilComplete[item.GetName()] = false
			}
		}
	}

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		for elem := range waitUntilComplete {
			_, err := h.Jobs.Resource.Get(context.Background(), elem, metav1.GetOptions{})
			switch {
			case err == nil:
				collect.Errorf("job(%s) for repo %s still exists", elem, repoName)
				return
			case apierrors.IsNotFound(err):
				// yay
				waitUntilComplete[elem] = true
			default:
				collect.Errorf("get(%s) for repo %s: %v", elem, repoName, err)
				return
			}
		}
		for elem, isComplete := range waitUntilComplete {
			if !isComplete {
				collect.Errorf("job(%s) for repo %s still exists", elem, repoName)
				return
			}
		}
	}, WaitTimeoutDefault, WaitIntervalDefault, "jobs for %s should finish. status: %v", repoName, waitUntilComplete)

	// Then wait for them to be listed as historic jobs
	var list *unstructured.UnstructuredList
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{}, "jobs")
		if !assert.NoError(collect, err, "failed to list historic jobs") {
			return
		}
		list, err = result.ToList()
		if !assert.NoError(collect, err, "results should be a list") {
			return
		}
		if !assert.NotEmpty(collect, list.Items, "expect at least one job") {
			return
		}
	}, WaitTimeoutDefault, WaitIntervalDefault, "failed to list historic jobs")

	// finally check that all the jobs are successful
	successCount := 0
	for _, elem := range list.Items {
		require.Equal(t, repoName, elem.GetLabels()[jobs.LabelRepository], "should have repo label")

		// historic jobs will have a suffix of -<hash>, trim that to see if the job is one we were waiting on
		if _, ok := waitUntilComplete[getNameBeforeLastDash(elem.GetName())]; ok && (MustNestedString(elem.Object, "status", "state") != string(provisioning.JobStateError)) {
			successCount++
		}
	}
	// can be greater if a pull job was queued by a background task
	require.GreaterOrEqual(t, successCount, len(waitUntilComplete), "should have all original jobs we were waiting on successful. got: %v. expected: %v", list.Items, waitUntilComplete)
}

func getNameBeforeLastDash(name string) string {
	lastDashIndex := strings.LastIndex(name, "-")
	if lastDashIndex == -1 {
		return name
	}
	return name[:lastDashIndex]
}

// RenderObject reads the filePath and renders it as a template with the given values.
// The template is expected to be a YAML or JSON file.
//
// The values object is mutated to also include the helper property as `h`.
func (h *ProvisioningTestHelper) RenderObject(t *testing.T, filePath string, values map[string]any) *unstructured.Unstructured {
	t.Helper()
	file := h.LoadFile(filePath)

	if values == nil {
		values = make(map[string]any)
	}
	values["h"] = h

	tmpl, err := template.New(filePath).Parse(string(file))
	require.NoError(t, err, "failed to parse template")

	var buf strings.Builder
	err = tmpl.Execute(&buf, values)
	require.NoError(t, err, "failed to execute template")

	return h.LoadYAMLOrJSON(buf.String())
}

// CopyToProvisioningPath copies a file to the provisioning path.
// The from path is relative to the test file's directory.
func (h *ProvisioningTestHelper) CopyToProvisioningPath(t *testing.T, from, to string) {
	fullPath := path.Join(h.ProvisioningPath, to)
	t.Logf("Copying file from '%s' to provisioning path '%s'", from, fullPath)
	err := os.MkdirAll(path.Dir(fullPath), 0o750)
	require.NoError(t, err, "failed to create directories for provisioning path")

	file := h.LoadFile(from)
	err = os.WriteFile(fullPath, file, 0o600)
	require.NoError(t, err, "failed to write file to provisioning path")
}

// WriteToProvisioningPath writes raw data to a file inside the provisioning path.
// Parent directories are created automatically.
func (h *ProvisioningTestHelper) WriteToProvisioningPath(t *testing.T, name string, data []byte) {
	t.Helper()
	fullPath := path.Join(h.ProvisioningPath, name)
	t.Logf("Writing file to provisioning path '%s'", fullPath)
	err := os.MkdirAll(path.Dir(fullPath), 0o750)
	require.NoError(t, err, "failed to create directories for provisioning path")
	err = os.WriteFile(fullPath, data, 0o600)
	require.NoError(t, err, "failed to write file to provisioning path")
}

// DebugState logs the current state of filesystem, repository, and Grafana resources for debugging
func (h *ProvisioningTestHelper) DebugState(t *testing.T, repo string, label string) {
	t.Helper()
	t.Logf("=== DEBUG STATE: %s ===", label)

	ctx := context.Background()

	// Log filesystem contents using existing tree function
	PrintFileTree(t, h.ProvisioningPath)

	// Log all repositories first
	t.Logf("All repositories:")
	repos, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("  ERROR listing repositories: %v", err)
	} else {
		t.Logf("  Total repositories: %d", len(repos.Items))
		for i, repository := range repos.Items {
			t.Logf("  Repository %d: name=%s", i+1, repository.GetName())
		}
	}

	// Log repository files for the specific repo
	t.Logf("Repository '%s' files:", repo)
	h.logRepositoryFiles(t, ctx, repo, "  ")

	// Log files for all other repositories too
	if repos != nil && len(repos.Items) > 1 {
		t.Logf("Files in other repositories:")
		for _, repository := range repos.Items {
			if repository.GetName() != repo {
				t.Logf("  Repository '%s' files:", repository.GetName())
				h.logRepositoryFiles(t, ctx, repository.GetName(), "    ")
			}
		}
	}

	// Log Grafana dashboards
	t.Logf("Grafana dashboards:")
	dashboards, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("  ERROR listing dashboards: %v", err)
	} else {
		t.Logf("  Total dashboards: %d", len(dashboards.Items))
		for i, dashboard := range dashboards.Items {
			t.Logf("  Dashboard %d: name=%s, UID=%s", i+1, dashboard.GetName(), dashboard.GetUID())
		}
	}

	// Log Grafana folders
	t.Logf("Grafana folders:")
	folders, err := h.Folders.Resource.List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Logf("  ERROR listing folders: %v", err)
	} else {
		t.Logf("  Total folders: %d", len(folders.Items))
		for i, folder := range folders.Items {
			t.Logf("  Folder %d: name=%s", i+1, folder.GetName())
		}
	}

	t.Logf("=== END DEBUG STATE ===")
}

// logRepositoryFiles logs repository file structure using the files API
func (h *ProvisioningTestHelper) logRepositoryFiles(t *testing.T, ctx context.Context, repoName string, prefix string) {
	t.Helper()

	// Try to list files at root level
	files, err := h.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files")
	if err != nil {
		t.Logf("%sERROR getting repository files: %v", prefix, err)
		return
	}

	// The API returns a structured response, we need to extract the actual file data
	if files.Object != nil {
		h.logRepositoryObject(t, files.Object, prefix, "")
	} else {
		t.Logf("%s(empty repository)", prefix)
	}
}

// logRepositoryObject recursively logs repository file structure from API response
func (h *ProvisioningTestHelper) logRepositoryObject(t *testing.T, obj map[string]interface{}, prefix string, currentPath string) {
	t.Helper()

	if obj == nil {
		return
	}

	// Skip metadata fields and focus on actual content
	for key, value := range obj {
		// Skip Kubernetes metadata fields
		if key == "kind" || key == "apiVersion" || key == "metadata" {
			continue
		}

		// Calculate new path for nested objects
		var newPath string
		if currentPath != "" {
			newPath = currentPath + "/" + key
		} else {
			newPath = key
		}

		switch v := value.(type) {
		case map[string]interface{}:
			t.Logf("%s├── %s/", prefix, key)
			h.logRepositoryObject(t, v, prefix+"  ", newPath)
		case []interface{}:
			// Handle lists (like items array)
			if key == "items" && len(v) > 0 {
				t.Logf("%s%d items:", prefix, len(v))
				for i, item := range v {
					if itemMap, ok := item.(map[string]interface{}); ok {
						// Try to get the actual file path from the item
						if pathVal, exists := itemMap["path"]; exists {
							t.Logf("%s├── %v", prefix, pathVal)
						} else {
							t.Logf("%s├── item %d:", prefix, i+1)
						}
						h.logRepositoryObject(t, itemMap, prefix+"  ", newPath)
					}
				}
			}
		default:
			// This could be file content or metadata
			// Skip common metadata fields that are not useful for debugging
			if key != "kind" && key != "apiVersion" && key != "path" && key != "size" && key != "hash" {
				t.Logf("%s├── %s: %v", prefix, key, value)
			}
		}
	}
}

// ValidateManagedDashboardsFolderMetadata validates the folder metadata
// of the managed dashboards.
// If folder is nested, folder annotations should not be empty.
// Also checks that the managerId property exists.
func (h *ProvisioningTestHelper) ValidateManagedDashboardsFolderMetadata(t *testing.T,
	ctx context.Context, repoName string, dashboards []unstructured.Unstructured) {
	t.Helper()

	// Check if folder is nested or not.
	// If not, folder annotations should be empty as we have an "instance" sync target
	for _, d := range dashboards {
		sourcePath, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/sourcePath")
		isNested := strings.Contains(sourcePath, "/")

		folder, found, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/folder")
		if isNested {
			require.True(t, found, "dashboard should have a folder annotation")
			require.NotEmpty(t, folder, "dashboard should be in a non-empty folder")
		} else {
			require.False(t, found, "dashboard should not have a folder annotation")
		}

		managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
		require.Equal(t, repoName, managerID, "dashboard should be managed by gitsync repo")
	}
}

type TestRepo struct {
	Name                   string
	Target                 string
	Path                   string
	Values                 map[string]any
	Copies                 map[string]string
	ExpectedDashboards     int
	ExpectedFolders        int
	SkipSync               bool
	SkipResourceAssertions bool
	Template               string
}

func (h *ProvisioningTestHelper) CreateRepo(t *testing.T, repo TestRepo) {
	if repo.Target == "" {
		repo.Target = "instance"
	}

	// Use custom path if provided, otherwise use default provisioning path
	repoPath := h.ProvisioningPath
	if repo.Path != "" {
		repoPath = repo.Path
		// Ensure the directory exists
		err := os.MkdirAll(repoPath, 0o750)
		require.NoError(t, err, "should be able to create repository path")
	}

	templateVars := map[string]any{
		"Name":        repo.Name,
		"SyncEnabled": !repo.SkipSync,
		"SyncTarget":  repo.Target,
	}
	if repo.Path != "" {
		templateVars["Path"] = repoPath
	}
	// Add custom values from TestRepo
	for key, value := range repo.Values {
		templateVars[key] = value
	}

	var thisFile string
	if _, file, _, ok := runtime.Caller(0); ok {
		thisFile = file
	}
	tmpl := filepath.Join(filepath.Dir(thisFile), "../testdata/local-write.json.tmpl")
	if repo.Template != "" {
		tmpl = repo.Template
	}
	localTmp := h.RenderObject(t, tmpl, templateVars)

	_, err := h.Repositories.Resource.Create(t.Context(), localTmp, metav1.CreateOptions{})
	require.NoError(t, err)
	h.WaitForHealthyRepository(t, repo.Name)

	for from, to := range repo.Copies {
		if repo.Path != "" {
			// Copy to custom path
			fullPath := path.Join(repoPath, to)
			err := os.MkdirAll(path.Dir(fullPath), 0o750)
			require.NoError(t, err, "failed to create directories for custom path")
			file := h.LoadFile(from)
			err = os.WriteFile(fullPath, file, 0o600)
			require.NoError(t, err, "failed to write file to custom path")
		} else {
			h.CopyToProvisioningPath(t, from, to)
		}
	}

	if !repo.SkipSync {
		// Trigger and wait for initial sync to populate resources
		h.SyncAndWait(t, repo.Name, nil)
		h.DebugState(t, repo.Name, "AFTER INITIAL SYNC")
	} else {
		h.DebugState(t, repo.Name, "AFTER REPO CREATION")
	}

	// Verify initial state
	if !repo.SkipResourceAssertions {
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := h.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
			if err != nil {
				collect.Errorf("could not list dashboards error: %s", err.Error())
				return
			}
			if len(dashboards.Items) != repo.ExpectedDashboards {
				collect.Errorf("should have the expected dashboards after sync. got: %d. expected: %d", len(dashboards.Items), repo.ExpectedDashboards)
				return
			}
			folders, err := h.Folders.Resource.List(t.Context(), metav1.ListOptions{})
			if err != nil {
				collect.Errorf("could not list folders: error: %s", err.Error())
				return
			}
			if len(folders.Items) != repo.ExpectedFolders {
				collect.Errorf("should have the expected folders after sync. got: %d. expected: %d", len(folders.Items), repo.ExpectedFolders)
				return
			}
			assert.Len(collect, dashboards.Items, repo.ExpectedDashboards)
			assert.Len(collect, folders.Items, repo.ExpectedFolders)
		}, WaitTimeoutDefault, WaitIntervalDefault, "should have the expected dashboards and folders after sync")
	}
}

// WaitForResourceQuotaLimit waits until the repository's Status.Quota.MaxResourcesPerRepository
// matches the expected limit.
func (h *ProvisioningTestHelper) WaitForResourceQuotaLimit(t *testing.T, repoName string, expectedLimit int64) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}

		repo := UnstructuredToRepository(t, repoObj)
		assert.Equal(collect, expectedLimit, repo.Status.Quota.MaxResourcesPerRepository,
			"repository quota limit not yet updated by controller")
	}, WaitTimeoutDefault, WaitIntervalDefault, "Status.Quota.MaxResourcesPerRepository should be %d", expectedLimit)
}

// WaitForQuotaReconciliation waits for the repository's quota condition to match the expected reason.
// It uses the typed Repository object and the quotas package to check conditions.
func (h *ProvisioningTestHelper) WaitForQuotaReconciliation(t *testing.T, repoName string, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}

		repo := UnstructuredToRepository(t, repoObj)
		condition := FindCondition(repo.Status.Conditions, provisioning.ConditionTypeResourceQuota)
		if !assert.NotNil(collect, condition, "Quota condition not found") {
			return
		}

		assert.Equal(collect, expectedReason, condition.Reason, "Quota condition reason mismatch")
	}, WaitTimeoutDefault, WaitIntervalDefault, "Quota condition should have reason %s", expectedReason)
}

// WaitForConditionReason waits for the repository's condition of the given type to match the expected reason.
func (h *ProvisioningTestHelper) WaitForConditionReason(t *testing.T, repoName string, conditionType string, expectedReason string) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}

		repo := UnstructuredToRepository(t, repoObj)
		condition := FindCondition(repo.Status.Conditions, conditionType)
		if !assert.NotNil(collect, condition, "%s condition not found", conditionType) {
			return
		}

		assert.Equal(collect, expectedReason, condition.Reason, "%s condition reason mismatch", conditionType)
	}, WaitTimeoutDefault, WaitIntervalDefault, "%s condition should have reason %s", conditionType, expectedReason)
}

// RequireRepoDashboardCount performs a one-off check that the number of dashboards managed by the given repo matches the expected count.
func (h *ProvisioningTestHelper) RequireRepoDashboardCount(t *testing.T, repoName string, expectedCount int) {
	t.Helper()
	dashboards, err := h.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list dashboards")

	var count int
	for _, d := range dashboards.Items {
		managerID, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId")
		if managerID == repoName {
			count++
		}
	}
	require.Equal(t, expectedCount, count, "unexpected number of dashboards managed by repo %s", repoName)
}

// TriggerConnectionReconciliation forces the controller to re-process a connection
// by touching its status (aging the health timestamp by 1ms).
// Retries on conflict errors caused by optimistic locking.
func (h *ProvisioningTestHelper) TriggerConnectionReconciliation(t *testing.T, name string) {
	t.Helper()
	ctx := t.Context()

	const maxRetries = 5
	for attempt := range maxRetries {
		conn, err := h.Connections.Resource.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err, "failed to get connection %s", name)

		health, ok := conn.Object["status"].(map[string]any)["health"].(map[string]any)
		require.True(t, ok, "missing status.health on connection %s", name)

		health["checked"] = time.Now().UnixMilli() - 1

		_, err = h.Connections.Resource.UpdateStatus(ctx, conn, metav1.UpdateOptions{})
		if err == nil {
			return
		}
		if apierrors.IsConflict(err) && attempt < maxRetries-1 {
			continue
		}
		require.NoError(t, err, "failed to update status for connection %s", name)
	}
}

// TriggerRepositoryReconciliation forces the controller to re-process a repo
// by touching its status (aging the health timestamp by 1ms).
// Updating it by incrementing its generation by +1 is not triggering a reconciliation.
// Retries on conflict errors caused by optimistic locking.
func (h *ProvisioningTestHelper) TriggerRepositoryReconciliation(t *testing.T, name string) {
	t.Helper()
	ctx := t.Context()

	const maxRetries = 5
	for attempt := range maxRetries {
		repo, err := h.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err, "failed to get repository %s", name)

		health, ok := repo.Object["status"].(map[string]any)["health"].(map[string]any)
		require.True(t, ok, "missing status.health on repository %s", name)

		health["checked"] = time.Now().UnixMilli() - 1

		_, err = h.Repositories.Resource.UpdateStatus(ctx, repo, metav1.UpdateOptions{})
		if err == nil {
			return
		}
		if apierrors.IsConflict(err) && attempt < maxRetries-1 {
			continue
		}
		require.NoError(t, err, "failed to update status for repository %s", name)
	}
}

// WaitForHealthyRepository waits for a repository to become healthy.
func (h *ProvisioningTestHelper) WaitForHealthyRepository(t *testing.T, name string) {
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repoStatus, err := h.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository status") {
			return
		}
		errType := MustNestedString(repoStatus.Object, "status", "health", "error")
		assert.Empty(collect, errType, "repository %s has health error: %s", name, errType)
		msgs := MustNestedStringSlice(repoStatus.Object, "status", "health", "message")
		assert.Empty(collect, msgs, "repository %s has health messages: %v", name, msgs)
		status, found := MustNestedBool(repoStatus.Object, "status", "health", "healthy")
		assert.True(collect, found, "repository %s does not have health status", name)
		assert.True(collect, status, "repository %s is not healthy yet", name)
	}, WaitTimeoutDefault, WaitIntervalDefault, "repository %s should become healthy", name)
}

func (h *ProvisioningTestHelper) WaitForUnhealthyRepository(t *testing.T, name string) {
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repoStatus, err := h.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository status") {
			return
		}
		checked, found := MustNestedInt64(repoStatus.Object, "status", "health", "checked")
		assert.True(collect, found, "repository %s does not have checked field", name)
		assert.Greater(collect, checked, int64(0), "repository %s health check has not run yet", name)
		status, found := MustNestedBool(repoStatus.Object, "status", "health", "healthy")
		assert.True(collect, found, "repository %s does not have health status", name)
		assert.False(collect, status, "repository %s should be unhealthy", name)
	}, WaitTimeoutDefault, WaitIntervalDefault, "repository %s should become unhealthy", name)
}

// GrafanaOption is a functional option for RunGrafana.
type GrafanaOption func(opts *testinfra.GrafanaOpts)

// Useful for debugging a test in development.
//
//lint:ignore U1000 This is used when needed while debugging.
//nolint:golint,unused
func WithLogs(opts *testinfra.GrafanaOpts) {
	opts.EnableLog = true
}

// WithProvisioningFolderMetadata enables the FlagProvisioningFolderMetadata feature toggle.
func WithProvisioningFolderMetadata(opts *testinfra.GrafanaOpts) {
	opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagProvisioningFolderMetadata)
}

func WithRepositoryTypes(types []string) GrafanaOption {
	return func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningRepositoryTypes = types
	}
}

// WithoutExportFeatureFlag disables the provisioningExport feature flag.
func WithoutExportFeatureFlag(opts *testinfra.GrafanaOpts) {
	// Remove provisioningExport from the enabled feature toggles
	filtered := []string{}
	for _, flag := range opts.EnableFeatureToggles {
		if flag != "provisioningExport" {
			filtered = append(filtered, flag)
		}
	}
	opts.EnableFeatureToggles = filtered
}

func RunGrafana(t *testing.T, options ...GrafanaOption) *ProvisioningTestHelper {
	provisioningPath := t.TempDir()
	opts := testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagProvisioningExport,
		},
		// Provisioning requires resources to be fully migrated to unified storage.
		// Mode5 ensures reads/writes go to unified storage, and EnableMigration
		// enables the data migration at startup to migrate legacy data.
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {
				DualWriterMode:  grafanarest.Mode5,
				EnableMigration: true,
			},
			"folders.folder.grafana.app": {
				DualWriterMode:  grafanarest.Mode5,
				EnableMigration: true,
			},
		},
		PermittedProvisioningPaths: ".|" + provisioningPath,
		// Allow both folder and instance sync targets for tests
		// (instance is needed for export jobs, folder for most operations)
		ProvisioningAllowedTargets: []string{"folder", "instance"},
	}

	for _, o := range options {
		o(&opts)
	}
	helper := apis.NewK8sTestHelper(t, opts)

	// FIXME: keeping these lines here to keep the dependency around until we have tests which use this again.
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()

	repositories := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})
	connections := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.ConnectionResourceInfo.GroupVersionResource(),
	})
	jobsClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})
	foldersClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})
	dashboardsV0 := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardV0.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV1 := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV2alpha1Client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardsV2alpha1.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV2beta1Client := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       dashboardsV2beta1.DashboardResourceInfo.GroupVersionResource(),
	})

	// Repo client, but less guard rails. Useful for subresources. We'll need this later...
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	adminClient := helper.Org1.Admin.RESTClient(t, gv)
	editorClient := helper.Org1.Editor.RESTClient(t, gv)
	viewerClient := helper.Org1.Viewer.RESTClient(t, gv)

	deleteAll := func(client *apis.K8sResourceClient) error {
		ctx := context.Background()
		list, err := client.Resource.List(ctx, metav1.ListOptions{})
		if err != nil {
			return err
		}
		for _, resource := range list.Items {
			if err := client.Resource.Delete(ctx, resource.GetName(), metav1.DeleteOptions{}); err != nil {
				return err
			}
		}
		return nil
	}

	require.NoError(t, deleteAll(dashboardsV1), "deleting all dashboards") // v0+v1+v2
	require.NoError(t, deleteAll(foldersClient), "deleting all folders")
	require.NoError(t, deleteAll(repositories), "deleting all repositories")

	return &ProvisioningTestHelper{
		ProvisioningPath: provisioningPath,
		K8sTestHelper:    helper,

		Repositories:       repositories,
		Connections:        connections,
		AdminREST:          adminClient,
		EditorREST:         editorClient,
		ViewerREST:         viewerClient,
		Jobs:               jobsClient,
		Folders:            foldersClient,
		DashboardsV0:       dashboardsV0,
		DashboardsV1:       dashboardsV1,
		DashboardsV2alpha1: dashboardsV2alpha1Client,
		DashboardsV2beta1:  dashboardsV2beta1Client,
	}
}

func MustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, err := unstructured.NestedString(obj, fields...)
	if err != nil {
		panic(err)
	}
	return v
}

func MustNestedBool(obj map[string]interface{}, fields ...string) (bool, bool) {
	v, found, err := unstructured.NestedBool(obj, fields...)
	if err != nil {
		panic(err)
	}

	return v, found
}

func MustNestedStringSlice(obj map[string]interface{}, fields ...string) []string {
	v, _, err := unstructured.NestedStringSlice(obj, fields...)
	if err != nil {
		panic(err)
	}
	return v
}

func MustNestedInt64(obj map[string]interface{}, fields ...string) (int64, bool) {
	v, found, err := unstructured.NestedInt64(obj, fields...)
	if err != nil {
		panic(err)
	}
	return v, found
}

func AsJSON(obj any) []byte {
	jj, _ := json.Marshal(obj)
	return jj
}

func UnstructuredToRepository(t *testing.T, obj *unstructured.Unstructured) *provisioning.Repository {
	bytes, err := obj.MarshalJSON()
	require.NoError(t, err)

	repo := &provisioning.Repository{}
	err = json.Unmarshal(bytes, repo)
	require.NoError(t, err)

	return repo
}

func RepositoryToUnstructured(t *testing.T, obj *provisioning.Repository) *unstructured.Unstructured {
	bytes, err := json.Marshal(obj)
	require.NoError(t, err)

	res := &unstructured.Unstructured{}
	err = res.UnmarshalJSON(bytes)
	require.NoError(t, err)

	return res
}

func UnstructuredToConnection(t *testing.T, obj *unstructured.Unstructured) *provisioning.Connection {
	bytes, err := obj.MarshalJSON()
	require.NoError(t, err)

	c := &provisioning.Connection{}
	err = json.Unmarshal(bytes, c)
	require.NoError(t, err)

	return c
}

// ParseTestResults extracts TestResults from an API response k8sruntime.Object.
func ParseTestResults(t *testing.T, obj k8sruntime.Object) *provisioning.TestResults {
	t.Helper()

	unstructuredObj, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected unstructured object")

	data, err := json.Marshal(unstructuredObj.Object)
	require.NoError(t, err)

	var testResults provisioning.TestResults
	err = json.Unmarshal(data, &testResults)
	require.NoError(t, err)

	return &testResults
}

// FilesPostOptions holds parameters for a direct HTTP POST to the files API.
// This bypasses Kubernetes REST client limitations with '/' characters in subresource names.
type FilesPostOptions struct {
	TargetPath   string // The target file/directory path
	OriginalPath string // Source path for move operations (optional)
	Message      string // Commit message (optional)
	Body         string // Request body content (optional)
	Ref          string // Git ref/branch (optional)
}

func (h *ProvisioningTestHelper) PostFilesRequest(t *testing.T, repo string, opts FilesPostOptions) *http.Response {
	addr := h.GetEnv().Server.HTTPServer.Listener.Addr().String()
	baseUrl := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s",
		addr, repo, opts.TargetPath)

	// Build the URL with proper query parameter encoding
	parsedUrl, err := url.Parse(baseUrl)
	require.NoError(t, err)
	params := parsedUrl.Query()

	if opts.OriginalPath != "" {
		params.Set("originalPath", opts.OriginalPath)
	}
	if opts.Message != "" {
		params.Set("message", opts.Message)
	}
	if opts.Ref != "" {
		params.Set("ref", opts.Ref)
	}
	parsedUrl.RawQuery = params.Encode()

	req, err := http.NewRequest(http.MethodPost, parsedUrl.String(), strings.NewReader(opts.Body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	return resp
}

// PrintFileTree prints the directory structure as a tree for debugging purposes
func PrintFileTree(t *testing.T, rootPath string) {
	t.Helper()
	t.Logf("File tree for %s:", rootPath)

	err := filepath.WalkDir(rootPath, func(filePath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(rootPath, filePath)
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

// CountFilesInDir counts files in a directory recursively
func CountFilesInDir(rootPath string) (int, error) {
	count := 0
	err := filepath.WalkDir(rootPath, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			count++
		}
		return nil
	})
	return count, err
}

// CleanupAllRepos deletes all repositories and waits for them to be fully removed
func (h *ProvisioningTestHelper) CleanupAllRepos(t *testing.T) {
	t.Helper()
	ctx := context.Background()

	// First, get all repositories that exist
	list, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
	if err != nil || len(list.Items) == 0 {
		return // Nothing to clean up
	}

	// Wait for any active jobs to complete before deleting repositories
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		activeJobs, err := h.Jobs.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list active jobs") {
			return
		}
		assert.Equal(collect, 0, len(activeJobs.Items), "all active jobs should complete before cleanup")
	}, WaitTimeoutDefault, WaitIntervalDefault, "active jobs should complete before cleanup")

	// Now delete all repositories with retries
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}

		for _, repo := range list.Items {
			err := h.Repositories.Resource.Delete(ctx, repo.GetName(), metav1.DeleteOptions{})
			// Don't fail if already deleted (404 is OK)
			if err != nil {
				assert.True(collect, apierrors.IsNotFound(err), "Should be able to delete repository %s (or it should already be deleted)", repo.GetName())
			}
		}
	}, WaitTimeoutDefault, WaitIntervalDefault, "should be able to delete all repositories")

	// Then wait for repositories to be fully deleted to ensure clean state
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		list, err := h.Repositories.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		assert.Equal(collect, 0, len(list.Items), "repositories should be cleaned up")
	}, WaitTimeoutDefault, WaitIntervalDefault, "repositories should be cleaned up between subtests")
}

func (h *ProvisioningTestHelper) CreateGithubConnection(
	t *testing.T,
	ctx context.Context,
	connection *unstructured.Unstructured,
) (*unstructured.Unstructured, error) {
	t.Helper()

	err := h.setGithubClient(t, connection)
	if err != nil {
		return nil, err
	}

	var res *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		res, err = h.Connections.Resource.Create(ctx, connection, metav1.CreateOptions{FieldValidation: "Strict"})
		require.NoError(collect, err)
	}, WaitTimeoutDefault, WaitIntervalDefault, "connection should be created")

	return res, nil
}

func (h *ProvisioningTestHelper) UpdateGithubConnection(
	t *testing.T,
	ctx context.Context,
	connection *unstructured.Unstructured,
) (*unstructured.Unstructured, error) {
	t.Helper()

	err := h.setGithubClient(t, connection)
	if err != nil {
		return nil, err
	}

	var res *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		res, err = h.Connections.Resource.Update(ctx, connection, metav1.UpdateOptions{FieldValidation: "Strict"})
		require.NoError(collect, err)
	}, WaitTimeoutDefault, WaitIntervalDefault, "connection should be updated")

	return res, nil
}

func (h *ProvisioningTestHelper) setGithubClient(t *testing.T, connection *unstructured.Unstructured) error {
	t.Helper()

	objectSpec := connection.Object["spec"].(map[string]interface{})
	githubObj := objectSpec["github"].(map[string]interface{})
	appID := githubObj["appID"].(string)
	id, err := strconv.ParseInt(appID, 10, 64)
	if err != nil {
		return err
	}

	appSlug := "someSlug"
	connectionFactory := h.GetEnv().GithubConnectionFactory.(*githubConnection.Factory)
	// Setup mock repositories for the ListRepos endpoint
	expectedRepos := []*github.Repository{
		{
			Name: github.Ptr("test-repo-1"),
			Owner: &github.User{
				Login: github.Ptr("test-owner-1"),
			},
			HTMLURL: github.Ptr("https://github.com/test-owner-1/test-repo-1"),
		},
		{
			Name: github.Ptr("test-repo-2"),
			Owner: &github.User{
				Login: github.Ptr("test-owner-2"),
			},
			HTMLURL: github.Ptr("https://github.com/test-owner-2/test-repo-2"),
		},
		{
			Name: github.Ptr("test-repo-3"),
			Owner: &github.User{
				Login: github.Ptr("test-owner-3"),
			},
			HTMLURL: github.Ptr("https://github.com/test-owner-3/test-repo-3"),
		},
	}

	connectionFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(
			ghmock.GetApp,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusOK)
				app := github.App{
					ID:   &id,
					Slug: &appSlug,
					Permissions: &github.InstallationPermissions{
						Contents:        github.Ptr("write"),
						Metadata:        github.Ptr("read"),
						PullRequests:    github.Ptr("write"),
						RepositoryHooks: github.Ptr("write"),
					},
				}
				_, _ = w.Write(ghmock.MustMarshal(app))
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.GetAppInstallationsByInstallationId,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				id := r.URL.Query().Get("installation_id")
				idInt, _ := strconv.ParseInt(id, 10, 64)
				w.WriteHeader(http.StatusOK)
				installation := github.Installation{
					ID: &idInt,
					Permissions: &github.InstallationPermissions{
						Contents:        github.Ptr("write"),
						Metadata:        github.Ptr("read"),
						PullRequests:    github.Ptr("write"),
						RepositoryHooks: github.Ptr("write"),
					},
				}
				_, _ = w.Write(ghmock.MustMarshal(installation))
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.PostAppInstallationsAccessTokensByInstallationId,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				installation := github.InstallationToken{
					Token:     github.Ptr("someToken"),
					ExpiresAt: &github.Timestamp{Time: time.Now().Add(time.Hour * 2)},
				}
				_, _ = w.Write(ghmock.MustMarshal(installation))
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.GetInstallationRepositories,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				reposResponse := &github.ListRepositories{
					Repositories: expectedRepos,
					TotalCount:   github.Ptr(len(expectedRepos)),
				}
				_, _ = w.Write(ghmock.MustMarshal(reposResponse))
			}),
		),
	)
	h.SetGithubConnectionFactory(connectionFactory)

	return nil
}

func PostHelper(t *testing.T, helper apis.K8sTestHelper, path string, body interface{}, user apis.User) (map[string]interface{}, int, error) {
	return requestHelper(t, helper, http.MethodPost, path, body, user)
}

func PatchHelper(t *testing.T, helper apis.K8sTestHelper, path string, body interface{}, user apis.User) (map[string]interface{}, int, error) {
	return requestHelper(t, helper, http.MethodPatch, path, body, user)
}

func requestHelper(
	t *testing.T,
	helper apis.K8sTestHelper,
	method string,
	path string,
	body interface{},
	user apis.User,
) (map[string]interface{}, int, error) {
	bodyJSON, err := json.Marshal(body)
	require.NoError(t, err)

	resp := apis.DoRequest(&helper, apis.RequestParams{
		User:        user,
		Method:      method,
		Path:        path,
		Body:        bodyJSON,
		ContentType: "application/json",
	}, &struct{}{})

	if resp.Response.StatusCode != http.StatusOK {
		res := map[string]interface{}{}
		err := json.Unmarshal(resp.Body, &res)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal response JSON: %v", err)
		}

		return res, resp.Response.StatusCode, fmt.Errorf("failure when making request: %s", resp.Response.Status)
	}

	var result map[string]interface{}
	err = json.Unmarshal(resp.Body, &result)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to unmarshal response JSON: %v", err)
	}

	return result, resp.Response.StatusCode, nil
}

// cloneRemote clones the remote into a fresh temporary directory (not git-init'd)
// and returns the clone path along with a cleanup function.
func (h *GitExportHelper) cloneRemote(t *testing.T, ctx context.Context, repoName string) (string, func()) {
	t.Helper()
	info, ok := h.repoInfos[repoName]
	if !ok {
		t.Fatalf("repo %q not registered with GitExportHelper – call CreateGitRepo first", repoName)
	}

	tmpDir, err := os.MkdirTemp("", "grafana-test-clone-*")
	require.NoError(t, err, "failed to create temp dir for git clone")

	cloneDir := filepath.Join(tmpDir, "repo")
	cmd := exec.CommandContext(ctx, "git", "clone", info.remote.AuthURL, cloneDir) //nolint:gosec
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	if out, err := cmd.CombinedOutput(); err != nil {
		_ = os.RemoveAll(tmpDir)
		t.Fatalf("failed to clone repo %q: %v\n%s", repoName, err, out)
	}

	return cloneDir, func() { _ = os.RemoveAll(tmpDir) }
}

// GitFileExists reports whether filePath exists on the main branch of repoName.
// It clones the repository via the git protocol (bypassing the provisioning files
// endpoint, which rejects hidden files such as .keep).
func (h *GitExportHelper) GitFileExists(t *testing.T, ctx context.Context, repoName, filePath string) bool {
	t.Helper()
	cloneDir, cleanup := h.cloneRemote(t, ctx, repoName)
	defer cleanup()

	_, err := os.Stat(filepath.Join(cloneDir, filePath))
	return err == nil
}

// GitReadFile returns the raw bytes of filePath on the main branch of repoName.
// It fails the test if the file does not exist.
func (h *GitExportHelper) GitReadFile(t *testing.T, ctx context.Context, repoName, filePath string) []byte {
	t.Helper()
	cloneDir, cleanup := h.cloneRemote(t, ctx, repoName)
	defer cleanup()

	data, err := os.ReadFile(filepath.Join(cloneDir, filePath)) //nolint:gosec
	require.NoError(t, err, "file %s not found in git repo %s", filePath, repoName)
	return data
}

// ExpectedDashboard describes the expected state of a single dashboard.
type ExpectedDashboard struct {
	Title      string
	SourcePath string
}

// RequireDashboardCount asserts the total number of dashboards in the instance.
func RequireDashboardCount(t *testing.T, dashboardClient *apis.K8sResourceClient, ctx context.Context, expected int) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		assert.Len(c, list.Items, expected, "unexpected dashboard count")
	}, WaitTimeoutDefault, WaitIntervalDefault, "expected %d dashboard(s)", expected)
}

// RequireDashboardTitle asserts that the dashboard with the given uid (K8s name)
// has the expected title.
func RequireDashboardTitle(t *testing.T, dashboardClient *apis.K8sResourceClient, ctx context.Context, uid, expectedTitle string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		for _, d := range list.Items {
			if d.GetName() != uid {
				continue
			}
			title, _, _ := unstructured.NestedString(d.Object, "spec", "title")
			assert.Equal(c, expectedTitle, title, "dashboard %q title mismatch", uid)
			return
		}
		c.Errorf("dashboard with uid %q not found", uid)
	}, WaitTimeoutDefault, WaitIntervalDefault, "dashboard %q should have title %q", uid, expectedTitle)
}

// RequireDashboards lists dashboards once and asserts that exactly the expected
// set exists with matching count, title, and grafana.app/sourcePath for each UID.
func RequireDashboards(t *testing.T, dashboardClient *apis.K8sResourceClient, ctx context.Context, expected map[string]ExpectedDashboard) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		if !assert.Len(c, list.Items, len(expected), "unexpected dashboard count") {
			return
		}
		for _, d := range list.Items {
			uid := d.GetName()
			exp, ok := expected[uid]
			if !assert.True(c, ok, "unexpected dashboard %q", uid) {
				continue
			}
			title, _, _ := unstructured.NestedString(d.Object, "spec", "title")
			assert.Equal(c, exp.Title, title, "dashboard %q title mismatch", uid)
			sp, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/sourcePath")
			assert.Equal(c, exp.SourcePath, sp, "dashboard %q sourcePath mismatch", uid)
		}
	}, WaitTimeoutDefault, WaitIntervalDefault, "dashboards should match expected state")
}

// RequireRepoFolders lists folders once and asserts that the set of
// grafana.app/sourcePath values for folders managed by repoName matches exactly.
func RequireRepoFolders(t *testing.T, folderClient *apis.K8sResourceClient, ctx context.Context, repoName string, expectedSourcePaths []string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := folderClient.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		var gotPaths []string
		for _, f := range list.Items {
			mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if mgr != repoName {
				continue
			}
			sp, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
			gotPaths = append(gotPaths, sp)
		}
		assert.ElementsMatch(c, expectedSourcePaths, gotPaths, "folder sourcePaths mismatch for repo %q", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"folders for repo %q should have sourcePaths %v", repoName, expectedSourcePaths)
}

// FindCondition finds a condition by type in the conditions list
func FindCondition(conditions []metav1.Condition, conditionType string) *metav1.Condition {
	for i := range conditions {
		if conditions[i].Type == conditionType {
			return &conditions[i]
		}
	}
	return nil
}

// ── Git-server helpers ──────────────────────────────────────────────────────

// gitRepoInfo stores the user and remote repository created for a named git repository.
type gitRepoInfo struct {
	user   *gittest.User
	remote *gittest.RemoteRepository
}

// GitExportHelper wraps ProvisioningTestHelper with an embedded gittest server
// so that export jobs can target a real remote git repository.
type GitExportHelper struct {
	*ProvisioningTestHelper
	gitServer *gittest.Server
	repoInfos map[string]*gitRepoInfo
}

// RunGrafanaWithGitServerForExport starts a Grafana instance with git
// repository support enabled alongside a local gittest server.
func RunGrafanaWithGitServerForExport(t *testing.T, options ...GrafanaOption) *GitExportHelper {
	t.Helper()

	ctx := context.Background()
	srv, err := gittest.NewServer(ctx, gittest.WithLogger(gittest.NewTestLogger(t)))
	require.NoError(t, err, "failed to start git server")
	t.Cleanup(func() {
		if err := srv.Cleanup(); err != nil {
			t.Logf("failed to cleanup git server: %v", err)
		}
	})

	allOpts := append([]GrafanaOption{WithRepositoryTypes([]string{"git"})}, options...)
	helper := RunGrafana(t, allOpts...)

	return &GitExportHelper{
		ProvisioningTestHelper: helper,
		gitServer:              srv,
		repoInfos:              make(map[string]*gitRepoInfo),
	}
}

// CreateGitRepo registers a new git repository on the test server with
// Grafana provisioning and waits for it to become healthy.
func (h *GitExportHelper) CreateGitRepo(t *testing.T, repoName string) {
	t.Helper()

	ctx := context.Background()

	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create git user")

	remote, err := h.gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, "failed to create remote git repository")

	h.repoInfos[repoName] = &gitRepoInfo{user: user, remote: remote}

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create local git repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	spec := map[string]interface{}{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata": map[string]interface{}{
			"name":      repoName,
			"namespace": "default",
		},
		"spec": map[string]interface{}{
			"title": repoName,
			"type":  "git",
			"git": map[string]interface{}{
				"url":       remote.URL,
				"branch":    "main",
				"tokenUser": user.Username,
			},
			"sync": map[string]interface{}{
				"enabled": false,
				"target":  "instance",
			},
			"workflows": []string{"write"},
		},
		"secure": map[string]interface{}{
			"token": map[string]interface{}{
				"create": user.Password,
			},
		},
	}

	body, err := json.Marshal(spec)
	require.NoError(t, err)

	result := h.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "failed to register git repository %q with Grafana", repoName)

	h.WaitForHealthyRepository(t, repoName)
}

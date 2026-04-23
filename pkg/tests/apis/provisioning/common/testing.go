package common

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	"sync"
	"testing"
	"text/template"
	"time"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8sruntime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardsV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardsV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	githubConnection "github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/nanogit/gittest"
)

const (
	WaitTimeoutDefault  = 60 * time.Second
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
-----END RSA PRIVATE KEY-----` // trufflehog:ignore

type ProvisioningTestHelper struct {
	*apis.K8sTestHelper
	ProvisioningPath string
	Namespace        string // Namespace for this helper (set by WithNamespace or defaults to "default")

	// Default clients for Org1 (backwards compatibility)
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

// WithNamespace returns a new ProvisioningTestHelper scoped to the specified namespace and user.
// This is useful for multi-org testing where you need separate helpers for different organizations.
func (h *ProvisioningTestHelper) WithNamespace(namespace string, user apis.User) *ProvisioningTestHelper {
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}

	return &ProvisioningTestHelper{
		ProvisioningPath: h.ProvisioningPath,
		Namespace:        namespace,
		K8sTestHelper:    h.K8sTestHelper,

		Repositories: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
		}),
		Connections: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       provisioning.ConnectionResourceInfo.GroupVersionResource(),
		}),
		Jobs: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
		}),
		Folders: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       folder.FolderResourceInfo.GroupVersionResource(),
		}),
		DashboardsV0: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       dashboardV0.DashboardResourceInfo.GroupVersionResource(),
		}),
		DashboardsV1: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
		}),
		DashboardsV2alpha1: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       dashboardsV2alpha1.DashboardResourceInfo.GroupVersionResource(),
		}),
		DashboardsV2beta1: h.GetResourceClient(apis.ResourceClientArgs{
			User:      user,
			Namespace: namespace,
			GVR:       dashboardsV2beta1.DashboardResourceInfo.GroupVersionResource(),
		}),
		AdminREST:  user.RESTClient(nil, gv),
		EditorREST: user.RESTClient(nil, gv),
		ViewerREST: user.RESTClient(nil, gv),
	}
}

// Cleanup deletes all provisioning resources in the helper's namespace.
// This should be called (typically via defer) after tests that create resources in specific namespaces.
func (h *ProvisioningTestHelper) Cleanup(t *testing.T) {
	t.Helper()
	ctx := context.Background()

	// Delete all repositories
	if err := h.Repositories.Resource.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{}); err != nil && !apierrors.IsNotFound(err) {
		t.Logf("warning: failed to delete repositories: %v", err)
	}

	// Delete all connections
	if err := h.Connections.Resource.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{}); err != nil && !apierrors.IsNotFound(err) {
		t.Logf("warning: failed to delete connections: %v", err)
	}

	// Delete all folders
	if err := h.Folders.Resource.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{}); err != nil && !apierrors.IsNotFound(err) {
		t.Logf("warning: failed to delete folders: %v", err)
	}

	// Delete all dashboards (V0, V1, V2alpha1, V2beta1)
	for _, client := range []*apis.K8sResourceClient{h.DashboardsV0, h.DashboardsV1, h.DashboardsV2alpha1, h.DashboardsV2beta1} {
		if client != nil {
			if err := client.Resource.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{}); err != nil && !apierrors.IsNotFound(err) {
				t.Logf("warning: failed to delete dashboards: %v", err)
			}
		}
	}
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
		h.AwaitJobs(t, repo)
		return
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")

	require.NotEmpty(t, unstruct.GetLabels()[jobs.LabelRepository])

	var completedJob *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		r, err := h.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{},
			"jobs", string(unstruct.GetUID()))

		if !assert.False(collect, apierrors.IsNotFound(err)) {
			collect.Errorf("job '%s' not found, still waiting for it to complete", name)
			return
		}

		assert.NoError(collect, err, "failed to get job '%s' to be found", name)
		if err != nil {
			return
		}

		completedJob = r
	}, WaitTimeoutDefault, WaitIntervalDefault)
	require.NotNil(t, completedJob, "expected job result to be non-nil")

	lastErrors := MustNestedStringSlice(completedJob.Object, "status", "errors")
	lastState := MustNestedString(completedJob.Object, "status", "state")

	if len(lastErrors) > 0 || lastState != string(provisioning.JobStateSuccess) {
		h.DebugState(t, repo, fmt.Sprintf("JOB FAILED: %s", completedJob.GetName()))
	}

	require.Empty(t, lastErrors, "historic job '%s' has errors: %v", completedJob.GetName(), lastErrors)
	require.Equal(t, string(provisioning.JobStateSuccess), lastState,
		"historic job '%s' was not successful", completedJob.GetName())
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
		t.Logf("job already running for repo %q; waiting for it to complete", repo)
		return h.AwaitLatestHistoricJob(t, repo)
	}

	obj, err := result.Get()
	require.NoError(t, err, "expecting to be able to sync repository")

	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expecting unstructured object, but got %T", obj)

	name := unstruct.GetName()
	require.NotEmpty(t, name, "expecting name to be set")

	require.NotEmpty(t, unstruct.GetLabels()[jobs.LabelRepository])

	var lastResult *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		r, err := h.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{},
			"jobs", string(unstruct.GetUID()))

		if !assert.False(collect, apierrors.IsNotFound(err)) {
			collect.Errorf("job '%s' not found, still waiting for it to complete", name)
			return
		}

		assert.NoError(collect, err, "failed to get job '%s' to be found", name)
		if err != nil {
			return
		}

		lastResult = r
	}, WaitTimeoutDefault, WaitIntervalDefault)
	require.NotNil(t, lastResult, "expected job result to be non-nil")

	return lastResult
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

func (h *ProvisioningTestHelper) AwaitJobs(t *testing.T, repoName string) {
	t.Helper()

	// Retry the full wait-and-check cycle to handle transient failures (e.g. network timeouts
	// when syncing from external Git repositories like GitHub).
	const maxRetries = 2
	for attempt := range maxRetries + 1 {
		if attempt > 0 {
			t.Logf("AwaitJobs: sync for %s completed with errors, retrying (attempt %d/%d)", repoName, attempt+1, maxRetries+1)
		}

		// Wait for all current jobs for the repository to disappear (i.e. complete/fail).
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

		// Check that all the jobs are successful
		successCount := 0
		for _, elem := range list.Items {
			require.Equal(t, repoName, elem.GetLabels()[jobs.LabelRepository], "should have repo label")

			// historic jobs will have a suffix of -<hash>, trim that to see if the job is one we were waiting on
			if _, ok := waitUntilComplete[getNameBeforeLastDash(elem.GetName())]; ok && (MustNestedString(elem.Object, "status", "state") != string(provisioning.JobStateError)) {
				successCount++
			}
		}

		// can be greater if a pull job was queued by a background task
		if successCount >= len(waitUntilComplete) {
			return
		}

		// On the final attempt, fail the test with a descriptive message
		if attempt == maxRetries {
			require.GreaterOrEqual(t, successCount, len(waitUntilComplete),
				"should have all original jobs we were waiting on successful after %d attempt(s). got: %v. expected: %v",
				maxRetries+1, list.Items, waitUntilComplete)
		}
	}
}

func getNameBeforeLastDash(name string) string {
	lastDashIndex := strings.LastIndex(name, "-")
	if lastDashIndex == -1 {
		return name
	}
	return name[:lastDashIndex]
}

// TestdataPath returns the absolute path to a file in the shared testdata directory.
func TestdataPath(filename string) string {
	//nolint:dogsled
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "../testdata", filename)
}

// RenderObject reads the filePath and renders it as a template with the given values.
// The template is expected to be a YAML or JSON file. Values can be any type (struct, map, etc.).
func (h *ProvisioningTestHelper) RenderObject(t *testing.T, filePath string, values any) *unstructured.Unstructured {
	t.Helper()
	file := readTestFile(t, filePath)

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

	file := readTestFile(t, from)
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

// readTestFile reads a file using the caller's testing.T instead of the shared
// K8sTestHelper's stored t. This avoids goroutine panics when the shared
// helper's t belongs to an already-completed test.
func readTestFile(t *testing.T, fpath string) []byte {
	t.Helper()
	raw, err := os.ReadFile(fpath) //nolint:gosec
	require.NoError(t, err, "failed to read test file %s", fpath)
	require.NotEmpty(t, raw, "test file %s is empty", fpath)
	return raw
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

func marshalWorkflows(t *testing.T, workflows []string) string {
	t.Helper()
	if workflows == nil {
		workflows = []string{}
	}
	b, err := json.Marshal(workflows)
	require.NoError(t, err)
	return string(b)
}

type TestRepo struct {
	// Template fields (directly accessible by Go templates via .FieldName)
	Name                      string
	Title                     string
	Description               string
	SyncEnabled               bool
	SyncTarget                string
	SyncIntervalSeconds       int
	Path                      string
	Workflows                 []string
	WorkflowsJSON             string
	URL                       string
	Branch                    string
	Token                     string
	TokenUser                 string
	WebhookSecret             string
	GenerateName              string
	GenerateDashboardPreviews bool

	// Test control fields (not used by templates)
	LocalPath              string
	Copies                 map[string]string
	ExpectedDashboards     int
	ExpectedFolders        int
	SkipSync               bool
	SkipResourceAssertions bool
	Template               string

	// InitialSyncExpectation overrides the matcher applied to the automatic
	// initial sync that CreateLocalRepo triggers (unless SkipSync is set).
	// When nil, the initial sync must finish in state "success" with no errors.
	// Use common.Warning() for repository states whose first sync is legitimately
	// expected to produce warnings (e.g. legacy folders tracked only via .keep
	// without _folder.json metadata).
	InitialSyncExpectation SyncOption
}

type LocalRepositorySpec struct {
	Name                string
	SyncEnabled         bool
	SyncTarget          string
	SyncIntervalSeconds int
	Path                string
	Title               string
	Description         string
	Workflows           []string
	WorkflowsJSON       string
}

func (h *ProvisioningTestHelper) CreateLocalRepository(t *testing.T, repo LocalRepositorySpec) {
	t.Helper()

	if repo.SyncTarget == "" {
		repo.SyncTarget = "folder"
	}
	if repo.Path == "" {
		repo.Path = h.ProvisioningPath
	}
	repo.WorkflowsJSON = marshalWorkflows(t, repo.Workflows)

	localRepo := h.RenderObject(t, TestdataPath("local.json.tmpl"), repo)

	_, err := h.Repositories.Resource.Create(t.Context(), localRepo, metav1.CreateOptions{})
	require.NoError(t, err)
	h.WaitForHealthyRepository(t, repo.Name)
}

type GitHubRepositorySpec struct {
	Name                      string
	GenerateName              string
	SyncEnabled               bool
	SyncTarget                string
	SyncIntervalSeconds       int
	URL                       string
	Branch                    string
	Path                      string
	Title                     string
	Description               string
	Token                     string
	TokenUser                 string
	WebhookSecret             string
	GenerateDashboardPreviews bool
	Workflows                 []string
	WorkflowsJSON             string
}

func (h *ProvisioningTestHelper) CreateGitHubRepository(t *testing.T, repo GitHubRepositorySpec) string {
	t.Helper()

	if repo.SyncTarget == "" {
		repo.SyncTarget = "folder"
	}
	repo.WorkflowsJSON = marshalWorkflows(t, repo.Workflows)

	githubRepo := h.RenderObject(t, TestdataPath("github.json.tmpl"), repo)
	createdRepo, err := h.Repositories.Resource.Create(t.Context(), githubRepo, metav1.CreateOptions{})
	require.NoError(t, err)
	createdName := createdRepo.GetName()
	require.NotEmpty(t, createdName)

	h.WaitForHealthyRepository(t, createdName)
	return createdName
}

func (h *ProvisioningTestHelper) CreateLocalRepo(t *testing.T, repo TestRepo) {
	if repo.SyncTarget == "" {
		repo.SyncTarget = "instance"
	}
	repo.SyncEnabled = !repo.SkipSync
	repo.WorkflowsJSON = marshalWorkflows(t, repo.Workflows)

	localPath := h.ProvisioningPath
	if repo.LocalPath != "" {
		localPath = repo.LocalPath
		err := os.MkdirAll(localPath, 0o750)
		require.NoError(t, err, "should be able to create repository path")
	}
	tmpl := TestdataPath("local.json.tmpl")
	if repo.Template != "" {
		tmpl = repo.Template
	} else if repo.Path == "" {
		repo.Path = localPath
	}
	localTmp := h.RenderObject(t, tmpl, repo)

	_, err := h.Repositories.Resource.Create(t.Context(), localTmp, metav1.CreateOptions{})
	require.NoError(t, err)
	h.WaitForHealthyRepository(t, repo.Name)

	for from, to := range repo.Copies {
		if repo.LocalPath != "" {
			fullPath := path.Join(localPath, to)
			err := os.MkdirAll(path.Dir(fullPath), 0o750)
			require.NoError(t, err, "failed to create directories for custom path")
			file := readTestFile(t, from)
			err = os.WriteFile(fullPath, file, 0o600)
			require.NoError(t, err, "failed to write file to custom path")
		} else {
			h.CopyToProvisioningPath(t, from, to)
		}
	}

	if !repo.SkipSync {
		expect := repo.InitialSyncExpectation
		if expect == nil {
			expect = Succeeded()
		}
		SyncAndWait(t, h, Repo(repo.Name), expect)
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

		repo := MustFromUnstructured[provisioning.Repository](t, repoObj)
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

		repo := MustFromUnstructured[provisioning.Repository](t, repoObj)
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

		repo := MustFromUnstructured[provisioning.Repository](t, repoObj)
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
// Uses EventuallyWithT to tolerate prolonged optimistic-locking conflicts from
// concurrent controller reconciliations (common with shared servers).
func (h *ProvisioningTestHelper) TriggerConnectionReconciliation(t *testing.T, name string) {
	t.Helper()
	ctx := t.Context()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		conn, err := h.Connections.Resource.Get(ctx, name, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get connection %s", name) {
			return
		}
		health, ok := conn.Object["status"].(map[string]any)["health"].(map[string]any)
		if !assert.True(c, ok, "missing status.health on connection %s", name) {
			return
		}
		health["checked"] = time.Now().UnixMilli() - 1
		_, err = h.Connections.Resource.UpdateStatus(ctx, conn, metav1.UpdateOptions{})
		assert.NoError(c, err, "failed to update status for connection %s", name)
	}, WaitTimeoutDefault, 200*time.Millisecond, "should trigger reconciliation for connection %s", name)
}

// TriggerRepositoryReconciliation forces the controller to re-process a repo
// by touching its status (aging the health timestamp by 1ms).
// Updating it by incrementing its generation by +1 is not triggering a reconciliation.
// Uses EventuallyWithT to tolerate prolonged optimistic-locking conflicts from
// concurrent controller reconciliations (common with shared servers).
func (h *ProvisioningTestHelper) TriggerRepositoryReconciliation(t *testing.T, name string) {
	t.Helper()
	ctx := t.Context()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get repository %s", name) {
			return
		}
		health, ok := repo.Object["status"].(map[string]any)["health"].(map[string]any)
		if !assert.True(c, ok, "missing status.health on repository %s", name) {
			return
		}
		health["checked"] = time.Now().UnixMilli() - 1
		_, err = h.Repositories.Resource.UpdateStatus(ctx, repo, metav1.UpdateOptions{})
		assert.NoError(c, err, "failed to update status for repository %s", name)
	}, WaitTimeoutDefault, 200*time.Millisecond, "should trigger reconciliation for repository %s", name)
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

// WithoutProvisioningFolderMetadata disables the FlagProvisioningFolderMetadata feature toggle.
func WithoutProvisioningFolderMetadata(opts *testinfra.GrafanaOpts) {
	opts.DisableFeatureToggles = append(opts.DisableFeatureToggles, featuremgmt.FlagProvisioningFolderMetadata)
}

func WithRepositoryTypes(types []string) GrafanaOption {
	return func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningRepositoryTypes = types
	}
}

// WithFolderAPIVersion sets the provisioning folder API version (e.g. "v1" or "v1beta1").
func WithFolderAPIVersion(version string) GrafanaOption {
	return func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningFolderAPIVersion = version
	}
}

// WithProvisioningMaxIncrementalChanges overrides the controller-side
// incremental-sync size threshold. A small value (e.g. 5) keeps tests fast
// when they need to exercise the full-sync fallback; 0 disables the check.
// Pass an int — the helper takes its address so GrafanaOpts can distinguish
// "not set" (nil) from an explicit 0.
func WithProvisioningMaxIncrementalChanges(n int) GrafanaOption {
	return func(opts *testinfra.GrafanaOpts) {
		opts.ProvisioningMaxIncrementalChanges = &n
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

func defaultGrafanaOpts(provisioningPath string) testinfra.GrafanaOpts {
	return testinfra.GrafanaOpts{
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
}

func buildProvisioningHelper(t *testing.T, k8sHelper *apis.K8sTestHelper, provisioningPath string) *ProvisioningTestHelper {
	t.Helper()

	k8sHelper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()

	repositories := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR:       provisioning.RepositoryResourceInfo.GroupVersionResource(),
	})
	connections := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.ConnectionResourceInfo.GroupVersionResource(),
	})
	jobsClient := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.JobResourceInfo.GroupVersionResource(),
	})
	foldersClient := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       folder.FolderResourceInfo.GroupVersionResource(),
	})
	dashboardsV0 := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       dashboardV0.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV1 := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV2alpha1Client := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       dashboardsV2alpha1.DashboardResourceInfo.GroupVersionResource(),
	})
	dashboardsV2beta1Client := k8sHelper.GetResourceClient(apis.ResourceClientArgs{
		User:      k8sHelper.Org1.Admin,
		Namespace: "default",
		GVR:       dashboardsV2beta1.DashboardResourceInfo.GroupVersionResource(),
	})

	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	adminClient := k8sHelper.Org1.Admin.RESTClient(t, gv)
	editorClient := k8sHelper.Org1.Editor.RESTClient(t, gv)
	viewerClient := k8sHelper.Org1.Viewer.RESTClient(t, gv)

	h := &ProvisioningTestHelper{
		ProvisioningPath: provisioningPath,
		Namespace:        "default", // Default namespace (org1)
		K8sTestHelper:    k8sHelper,

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

	h.CleanupAllResources(t, context.Background())

	return h
}

func RunGrafana(t *testing.T, options ...GrafanaOption) *ProvisioningTestHelper {
	provisioningPath := t.TempDir()
	opts := defaultGrafanaOpts(provisioningPath)
	for _, o := range options {
		o(&opts)
	}
	k8sHelper := apis.NewK8sTestHelper(t, opts)
	return buildProvisioningHelper(t, k8sHelper, provisioningPath)
}

// RunGrafanaShared is like RunGrafana but the server shutdown is not tied to
// t.Cleanup. The caller is responsible for invoking the returned shutdown
// function (typically in TestMain after m.Run). The provisioning path uses
// os.MkdirTemp so it survives beyond the initializing test's lifetime.
func runGrafanaShared(t *testing.T, options ...GrafanaOption) (*ProvisioningTestHelper, func()) {
	provisioningPath, err := os.MkdirTemp("", "grafana-provisioning-*")
	require.NoError(t, err, "failed to create shared provisioning temp dir")

	opts := defaultGrafanaOpts(provisioningPath)
	for _, o := range options {
		o(&opts)
	}
	k8sHelper, serverShutdown := apis.NewK8sTestHelperShared(t, apis.K8sTestHelperOpts{GrafanaOpts: opts})
	shutdownFunc := func() {
		serverShutdown()
		_ = os.RemoveAll(provisioningPath)
	}
	return buildProvisioningHelper(t, k8sHelper, provisioningPath), shutdownFunc
}

// deleteAndWait deletes all resources from a dynamic client and polls until
// none remain. It retries deletes on each iteration to handle transient
// resource-version conflicts from concurrent controller updates.
func deleteAndWait(ctx context.Context, client dynamic.ResourceInterface, timeout time.Duration) error {
	list, err := client.List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("deleteAndWait: initial list: %w", err)
	}
	if len(list.Items) == 0 {
		return nil
	}

	var firstErr error
	for _, item := range list.Items {
		if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			if firstErr == nil {
				firstErr = fmt.Errorf("deleteAndWait: delete %q: %w", item.GetName(), err)
			}
		}
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		remaining, err := client.List(ctx, metav1.ListOptions{})
		if err != nil {
			return fmt.Errorf("deleteAndWait: list while polling: %w", err)
		}
		if len(remaining.Items) == 0 {
			return nil
		}
		for _, item := range remaining.Items {
			if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				if firstErr == nil {
					firstErr = fmt.Errorf("deleteAndWait: delete %q: %w", item.GetName(), err)
				}
			}
		}
		select {
		case <-ctx.Done():
			if firstErr != nil {
				return fmt.Errorf("deleteAndWait: context cancelled (first delete error: %v): %w", firstErr, ctx.Err())
			}
			return fmt.Errorf("deleteAndWait: context cancelled: %w", ctx.Err())
		case <-timer.C:
			if firstErr != nil {
				return fmt.Errorf("deleteAndWait: timed out with %d items remaining (first delete error: %v)", len(remaining.Items), firstErr)
			}
			return fmt.Errorf("deleteAndWait: timed out with %d items remaining", len(remaining.Items))
		case <-ticker.C:
		}
	}
}

// CleanupAllResources deletes resources in dependency order: repositories
// reference connections, so they go first; dashboards/folders are cleaned last.
// It also clears the shared provisioning directory so leftover files from
// a previous test don't leak into the next one.
// Failures are fatal because cleanup is the primary test-isolation mechanism.
func (h *ProvisioningTestHelper) CleanupAllResources(t *testing.T, ctx context.Context) {
	t.Helper()
	for _, c := range []struct {
		name   string
		client dynamic.ResourceInterface
	}{
		{"repositories", h.Repositories.Resource},
		{"connections", h.Connections.Resource},
		{"dashboards", h.DashboardsV1.Resource},
		{"folders", h.Folders.Resource},
	} {
		if err := deleteAndWait(ctx, c.client, 10*time.Second); err != nil {
			t.Fatalf("CleanupAllResources(%s): %v", c.name, err)
		}
	}
	entries, err := os.ReadDir(h.ProvisioningPath)
	if err == nil {
		for _, entry := range entries {
			require.NoError(t, os.RemoveAll(filepath.Join(h.ProvisioningPath, entry.Name())),
				"failed to clean provisioning dir entry %s", entry.Name())
		}
	}
}

// SharedEnv manages a single shared Grafana server for a test package.
// It encapsulates the sync.Once init, server shutdown, and TestMain lifecycle
// so that individual packages only need to define their per-test cleanup.
//
// H is typically *ProvisioningTestHelper or *GitTestHelper.
type SharedEnv[H interface {
	comparable
	CleanupAllResources(*testing.T, context.Context)
}] struct {
	Helper       H
	shutdownFunc func()
	once         sync.Once
	initErr      string
	label        string
	initFn       func(*testing.T, ...GrafanaOption) (H, func())
	options      []GrafanaOption
}

// NewSharedEnv creates a SharedEnv that will lazily start a Grafana server
// with the given options on the first call to GetHelper.
func NewSharedEnv(options ...GrafanaOption) *SharedEnv[*ProvisioningTestHelper] {
	return &SharedEnv[*ProvisioningTestHelper]{
		label:   "shared server",
		initFn:  runGrafanaShared,
		options: options,
	}
}

// GetHelper returns the shared helper, starting the server on the first call
// (via sync.Once). Subsequent calls reuse the same server. The test is skipped
// automatically when running in short mode.
//
// If initialization fails (panic or t.FailNow/runtime.Goexit), the error is
// persisted and every subsequent caller gets a clear t.Fatal rather than a
// nil-pointer crash.
func (e *SharedEnv[H]) GetHelper(t *testing.T) H {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)

	e.once.Do(func() {
		var zero H
		defer func() {
			if r := recover(); r != nil {
				e.initErr = fmt.Sprintf("%s init panicked: %v", e.label, r)
			} else if e.Helper == zero && e.initErr == "" {
				e.initErr = fmt.Sprintf("%s init failed (FailNow/Goexit called; see first test output)", e.label)
			}
		}()
		e.Helper, e.shutdownFunc = e.initFn(t, e.options...)
	})

	if e.initErr != "" {
		t.Fatalf("%s: %s", e.label, e.initErr)
	}

	return e.Helper
}

// GetCleanHelper returns the shared helper after cleaning up all resources
// from the previous test. This is the standard per-test entry point.
func (e *SharedEnv[H]) GetCleanHelper(t *testing.T) H {
	t.Helper()
	h := e.GetHelper(t)
	h.CleanupAllResources(t, context.Background())
	return h
}

// Shutdown stops the shared servers if they were started.
func (e *SharedEnv[H]) Shutdown() {
	if e.shutdownFunc != nil {
		e.shutdownFunc()
	}
}

// RunTestMain replaces testsuite.Run(m) for packages that share a Grafana
// server. It handles DB setup, runs all tests, shuts down the shared server,
// cleans up the DB, and exits.
func (e *SharedEnv[H]) RunTestMain(m *testing.M) {
	db.SetupTestDB()
	code := m.Run()
	e.Shutdown()
	db.CleanupTestDB()
	os.Exit(code)
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

// ToUnstructured converts a typed K8s object to an unstructured representation
// using the canonical DefaultUnstructuredConverter.
func ToUnstructured[T any](obj *T) (*unstructured.Unstructured, error) {
	raw, err := k8sruntime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: raw}, nil
}

// FromUnstructured converts an unstructured object to a typed K8s object
// using the canonical DefaultUnstructuredConverter.
func FromUnstructured[T any](obj *unstructured.Unstructured) (*T, error) {
	result := new(T)
	err := k8sruntime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, result)
	return result, err
}

// MustToUnstructured is a test-fatal wrapper around ToUnstructured.
func MustToUnstructured[T any](t *testing.T, obj *T) *unstructured.Unstructured {
	t.Helper()
	result, err := ToUnstructured(obj)
	require.NoError(t, err)
	return result
}

// MustFromUnstructured is a test-fatal wrapper around FromUnstructured.
func MustFromUnstructured[T any](t *testing.T, obj *unstructured.Unstructured) *T {
	t.Helper()
	result, err := FromUnstructured[T](obj)
	require.NoError(t, err)
	return result
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

// FilesClient provides convenience methods for interacting with the provisioning
// files subresource (/repositories/{repo}/files/{path}) via direct HTTP.
// It avoids the Kubernetes REST client limitation with '/' in subresource names.
type FilesClient struct {
	helper *ProvisioningTestHelper
	repo   string
	user   string // basic-auth credentials, e.g. "admin:admin"
}

// NewFilesClient returns a FilesClient for the given repo using admin credentials.
func (h *ProvisioningTestHelper) NewFilesClient(repo string) *FilesClient {
	return &FilesClient{helper: h, repo: repo, user: "admin:admin"}
}

// WithUser returns a copy of the client that authenticates as user (e.g. "editor:editor").
func (c *FilesClient) WithUser(user string) *FilesClient {
	return &FilesClient{helper: c.helper, repo: c.repo, user: user}
}

// URL returns the full HTTP URL for the given file or directory path.
func (c *FilesClient) URL(filePath string) string {
	addr := c.helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	return fmt.Sprintf("http://%s@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s",
		c.user, addr, c.repo, filePath)
}

// FilesResponse holds the status code and body from a files endpoint request.
type FilesResponse struct {
	StatusCode int
	Body       []byte
}

// BodyString returns the response body as a string.
func (r *FilesResponse) BodyString() string { return string(r.Body) }

// Do executes an HTTP request to the files endpoint and returns the response.
// The response body is read and closed before returning.
func (c *FilesClient) Do(t *testing.T, method, filePath string, body []byte) *FilesResponse {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, c.URL(filePath), bodyReader)
	require.NoError(t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() {
		require.NoError(t, resp.Body.Close())
	}()
	respBody, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return &FilesResponse{StatusCode: resp.StatusCode, Body: respBody}
}

// Post sends a POST request to the given path with no body.
func (c *FilesClient) Post(t *testing.T, filePath string) *FilesResponse {
	t.Helper()
	return c.Do(t, http.MethodPost, filePath, nil)
}

// Put sends a PUT request to the given path with a JSON body.
func (c *FilesClient) Put(t *testing.T, filePath string, body []byte) *FilesResponse {
	t.Helper()
	return c.Do(t, http.MethodPut, filePath, body)
}

// Delete sends a DELETE request to the given path.
func (c *FilesClient) Delete(t *testing.T, filePath string) *FilesResponse {
	t.Helper()
	return c.Do(t, http.MethodDelete, filePath, nil)
}

// FolderBody builds a JSON-encoded Folder resource for PUT requests.
// uid is optional — pass an empty string to omit metadata.name.
// title is required for most mutations but may be empty to test validation.
func FolderBody(t *testing.T, uid, title string) []byte {
	t.Helper()
	f := folder.Folder{
		TypeMeta: metav1.TypeMeta{
			APIVersion: folder.GroupVersion.String(),
			Kind:       "Folder",
		},
		Spec: folder.FolderSpec{Title: title},
	}
	if uid != "" {
		f.Name = uid
	}
	data, err := json.Marshal(f)
	require.NoError(t, err)
	return data
}

// ReadFolderUID reads the folder UID (metadata.name) from the _folder.json at the given path.
func (c *FilesClient) ReadFolderUID(t *testing.T, ctx context.Context, metadataPath string) string {
	t.Helper()
	return c.readFolderField(t, ctx, metadataPath, "metadata", "name")
}

// ReadFolderTitle reads the folder title (spec.title) from the _folder.json at the given path.
func (c *FilesClient) ReadFolderTitle(t *testing.T, ctx context.Context, metadataPath string) string {
	t.Helper()
	return c.readFolderField(t, ctx, metadataPath, "spec", "title")
}

func (c *FilesClient) readFolderField(t *testing.T, ctx context.Context, metadataPath string, fields ...string) string {
	t.Helper()
	wrapObj, err := c.helper.Repositories.Resource.Get(ctx, c.repo, metav1.GetOptions{}, "files", metadataPath)
	require.NoError(t, err, "%s: should be readable via the files endpoint", metadataPath)
	keyPath := append([]string{"resource", "file"}, fields...)
	val, _, _ := unstructured.NestedString(wrapObj.Object, keyPath...)
	return val
}

// RequireValidFolderMetadata reads the _folder.json at folderPath/_folder.json,
// asserts it has a valid apiVersion, kind, non-empty UID and title, and returns (uid, title).
func (c *FilesClient) RequireValidFolderMetadata(t *testing.T, ctx context.Context, folderMetadataPath string) (uid, title string) {
	t.Helper()
	wrapObj, err := c.helper.Repositories.Resource.Get(ctx, c.repo, metav1.GetOptions{}, "files", folderMetadataPath)
	require.NoError(t, err, "%s: _folder.json should be readable via the files endpoint", folderMetadataPath)

	apiVersion, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "apiVersion")
	require.Equal(t, "folder.grafana.app/v1", apiVersion, "%s: unexpected apiVersion", folderMetadataPath)
	kind, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "kind")
	require.Equal(t, "Folder", kind, "%s: unexpected kind", folderMetadataPath)

	uid, _, _ = unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
	require.NotEmpty(t, uid, "%s: should have a non-empty UID", folderMetadataPath)
	title, _, _ = unstructured.NestedString(wrapObj.Object, "resource", "file", "spec", "title")
	require.NotEmpty(t, title, "%s: should have a non-empty title", folderMetadataPath)

	return uid, title
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

func DeleteHelper(t *testing.T, helper apis.K8sTestHelper, path string, user apis.User) {
	t.Helper()
	resp := apis.DoRequest(&helper, apis.RequestParams{
		User:   user,
		Method: http.MethodDelete,
		Path:   path,
	}, &struct{}{})
	require.Equal(t, http.StatusOK, resp.Response.StatusCode, "DELETE %s failed: %s", path, string(resp.Body))
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

// ExpectedDashboard describes the expected state of a single dashboard.
type ExpectedDashboard struct {
	Title      string
	SourcePath string
	Folder     string // grafana.app/folder annotation; only checked when non-empty
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
			if exp.Folder != "" {
				folder, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/folder")
				assert.Equal(c, exp.Folder, folder, "dashboard %q folder mismatch", uid)
			}
		}
	}, WaitTimeoutDefault, WaitIntervalDefault, "dashboards should match expected state")
}

// RequireRepoDashboardParent asserts that the dashboard managed by repoName at
// the given sourcePath is parented to the expected folder UID.
func RequireRepoDashboardParent(t *testing.T, dashboardClient *apis.K8sResourceClient, ctx context.Context, repoName, sourcePath, expectedFolderUID string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := dashboardClient.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		for _, d := range list.Items {
			annotations := d.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] != sourcePath {
				continue
			}
			assert.Equal(c, expectedFolderUID, annotations["grafana.app/folder"], "dashboard %q parent folder", sourcePath)
			return
		}
		c.Errorf("dashboard with sourcePath %q not found for repo %q", sourcePath, repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected dashboard %q to be parented to folder %q for repo %q", sourcePath, expectedFolderUID, repoName)
}

// RequireRepoFolderTitle asserts that a folder managed by repoName exists with
// the given title and returns its UID.
func RequireRepoFolderTitle(t *testing.T, folderClient *apis.K8sResourceClient, ctx context.Context, repoName, expectedTitle string) string {
	t.Helper()
	var folderUID string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := folderClient.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		for _, f := range list.Items {
			mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
			if mgr != repoName {
				continue
			}
			title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
			if title == expectedTitle {
				folderUID = f.GetName()
				return
			}
		}
		c.Errorf("no folder managed by %q with title %q found", repoName, expectedTitle)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected folder with title %q for repo %q", expectedTitle, repoName)
	return folderUID
}

// RequireRepoFolderTitle asserts that a folder managed by repoName exists with
// the given title and returns its UID.
func RequireRepoFolderUID(t *testing.T, folderClient *apis.K8sResourceClient, ctx context.Context, repoName, expectedUID string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		folder, err := folderClient.Resource.Get(ctx, expectedUID, metav1.GetOptions{})
		require.NoError(c, err, "failed to get folder")
		mgr, _, _ := unstructured.NestedString(folder.Object, "metadata", "annotations", "grafana.app/managerId")
		require.Equal(c, repoName, mgr, "folder %q is not managed by %q", expectedUID, repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault, "expected folder with UID %q for repo %q", expectedUID, repoName)
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
			gotPaths = append(gotPaths, strings.TrimSuffix(sp, "/"))
		}
		assert.ElementsMatch(c, expectedSourcePaths, gotPaths, "folder sourcePaths mismatch for repo %q", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"folders for repo %q should have sourcePaths %v", repoName, expectedSourcePaths)
}

// WaitForRepoLastRef waits until the repository's status.sync.lastRef is
// non-empty. This must be satisfied before triggering an incremental sync,
// otherwise the syncer falls back to a full sync.
func waitForRepoLastRef(t *testing.T, repositories *apis.K8sResourceClient, repoName string) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repo, err := repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository %s", repoName) {
			return
		}

		lastRef, _, _ := unstructured.NestedString(repo.Object, "status", "sync", "lastRef")
		assert.NotEmpty(collect, lastRef, "repository %s should have lastRef set", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault, "repository %s should have lastRef set after sync", repoName)
}

// SyncHelper abstracts the ability to trigger sync jobs and inspect repository
// state. Both ProvisioningTestHelper and gitTestHelper satisfy this interface.
type SyncHelper interface {
	TriggerJobAndWaitForComplete(t *testing.T, repoName string, spec provisioning.JobSpec) *unstructured.Unstructured
	GetRepositories() *apis.K8sResourceClient
}

// GetRepositories implements SyncHelper.
func (h *ProvisioningTestHelper) GetRepositories() *apis.K8sResourceClient {
	return h.Repositories
}

// ---------------------------------------------------------------------------
// Job matchers — composable assertions for completed sync jobs.
// ---------------------------------------------------------------------------

// JobMatcher asserts properties of a completed sync job.
type JobMatcher func(t *testing.T, job *unstructured.Unstructured)

// HasState returns a matcher that asserts the job finished in the given state.
func HasState(expected provisioning.JobState) JobMatcher {
	return func(t *testing.T, job *unstructured.Unstructured) {
		t.Helper()
		actual := MustNestedString(job.Object, "status", "state")
		require.Equal(t, string(expected), actual,
			"job %q should have state %s", job.GetName(), expected)
	}
}

// HasNoErrors returns a matcher that asserts the job completed without errors.
func HasNoErrors() JobMatcher {
	return func(t *testing.T, job *unstructured.Unstructured) {
		t.Helper()
		errs := MustNestedStringSlice(job.Object, "status", "errors")
		require.Empty(t, errs, "job %q has errors: %v", job.GetName(), errs)
	}
}

// ---------------------------------------------------------------------------
// SyncAndWait — configurable pull-sync helper.
// ---------------------------------------------------------------------------

// SyncOption configures the behaviour of SyncAndWait.
type SyncOption func(*syncOpts)

type syncOpts struct {
	repoName    string
	incremental bool
	matchers    []JobMatcher
}

// Repo sets the repository name for the sync.
func Repo(name string) SyncOption {
	return func(o *syncOpts) { o.repoName = name }
}

// Incremental makes SyncAndWait trigger an incremental pull instead of a full one.
func Incremental(o *syncOpts) { o.incremental = true }

// Expect adds arbitrary job matchers that are applied to the completed job.
// For the common cases prefer Succeeded() or Warning() directly.
func Expect(m ...JobMatcher) SyncOption {
	return func(o *syncOpts) {
		o.matchers = append(o.matchers, m...)
	}
}

// Succeeded is a SyncOption that asserts the job succeeded with no errors.
func Succeeded() SyncOption {
	return Expect(HasNoErrors(), HasState(provisioning.JobStateSuccess))
}

// Warning is a SyncOption that asserts the job finished with warning state
// and no errors.
func Warning() SyncOption {
	return Expect(HasNoErrors(), HasState(provisioning.JobStateWarning))
}

// SyncAndWait triggers a pull sync, waits for it to complete, and asserts the
// expected outcome using the provided matchers.
//
// Every call must include Repo() to identify the target repository and an
// expectation such as Succeeded() or Warning(). Pass Incremental for an
// incremental sync.
//
// Full (non-incremental) syncs also wait for the repository's lastRef to be
// set, which is required before an incremental sync can be triggered.
func SyncAndWait(t *testing.T, h SyncHelper, opts ...SyncOption) {
	t.Helper()

	o := syncOpts{}
	for _, fn := range opts {
		fn(&o)
	}

	require.NotEmpty(t, o.repoName, "SyncAndWait requires Repo()")
	require.NotEmpty(t, o.matchers, "SyncAndWait requires an expectation such as Succeeded() or Warning()")

	job := h.TriggerJobAndWaitForComplete(t, o.repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: o.incremental},
	})

	for _, m := range o.matchers {
		m(t, job)
	}

	if !o.incremental {
		waitForRepoLastRef(t, h.GetRepositories(), o.repoName)
	}
}

// RequireJobWarning asserts that a completed job has state "warning" and no errors.
// Prefer Warning() for use with SyncAndWait; this standalone function is kept
// for callers that assert on a job obtained outside SyncAndWait.
func RequireJobWarning(t *testing.T, job *unstructured.Unstructured) {
	t.Helper()
	HasNoErrors()(t, job)
	HasState(provisioning.JobStateWarning)(t, job)
}

// GetFolderGeneration returns the current generation of the folder with the given UID.
func GetFolderGeneration(t *testing.T, helper *ProvisioningTestHelper, folderUID string) int64 {
	t.Helper()
	obj, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
	require.NoError(t, err, "failed to get folder %s", folderUID)
	return obj.GetGeneration()
}

// FindDashboardUIDBySourcePath returns the UID of the dashboard managed by repoName at sourcePath.
func FindDashboardUIDBySourcePath(t *testing.T, helper *ProvisioningTestHelper, repoName, sourcePath string) string {
	t.Helper()
	var uid string
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		for _, d := range list.Items {
			annotations := d.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			if annotations["grafana.app/sourcePath"] == sourcePath {
				uid = d.GetName()
				return
			}
		}
		c.Errorf("no dashboard managed by %q with sourcePath %q found", repoName, sourcePath)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected dashboard with sourcePath %q for repo %q", sourcePath, repoName)
	return uid
}

// ObjectSnapshot captures the identity and version fields of a K8s object
// so we can later verify it was updated in place (not deleted+recreated).
type ObjectSnapshot struct {
	UID               string
	Generation        int64
	CreationTimestamp metav1.Time
}

// SnapshotObject extracts an ObjectSnapshot from an Unstructured K8s object.
func SnapshotObject(t *testing.T, obj *unstructured.Unstructured) ObjectSnapshot {
	t.Helper()
	return ObjectSnapshot{
		UID:               string(obj.GetUID()),
		Generation:        obj.GetGeneration(),
		CreationTimestamp: obj.GetCreationTimestamp(),
	}
}

// RequireUpdatedInPlace asserts that the object was updated in place, not
// deleted and recreated. It compares the UID (definitive identity), the
// creationTimestamp, and verifies that the generation has not decreased.
func RequireUpdatedInPlace(t *testing.T, label string, before, after ObjectSnapshot) {
	t.Helper()
	require.Equal(t, before.UID, after.UID,
		"%s: UID changed — object was recreated instead of updated", label)
	require.Equal(t, before.CreationTimestamp, after.CreationTimestamp,
		"%s: creationTimestamp changed — object was recreated instead of updated", label)
	require.GreaterOrEqual(t, after.Generation, before.Generation,
		"%s: generation decreased — object was recreated instead of updated", label)
}

func RequireFolderState(t *testing.T, folderClient *apis.K8sResourceClient, folderUID, expectedTitle, expectedSourcePath, expectedParent string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		obj, err := folderClient.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get folder %s", folderUID) {
			return
		}

		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		assert.Equal(c, expectedTitle, title, "folder title")

		annotations := obj.GetAnnotations()
		assert.Equal(c, expectedSourcePath, annotations["grafana.app/sourcePath"], "source path")
		assert.Equal(c, expectedParent, annotations["grafana.app/folder"], "parent folder")
	}, 30*time.Second, 100*time.Millisecond,
		"expected folder %q with title=%q sourcePath=%q parent=%q", folderUID, expectedTitle, expectedSourcePath, expectedParent)
}

// SnapshotDashboardsBySourcePath returns a map from sourcePath to ObjectSnapshot
// for dashboards managed by the given repo. It waits until all requested paths are found.
func SnapshotDashboardsBySourcePath(t *testing.T, helper *ProvisioningTestHelper, repoName string, paths []string) map[string]ObjectSnapshot {
	t.Helper()
	wanted := make(map[string]bool, len(paths))
	for _, p := range paths {
		wanted[p] = true
	}
	result := make(map[string]ObjectSnapshot, len(paths))

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		for i := range list.Items {
			annotations := list.Items[i].GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName {
				continue
			}
			sp := annotations["grafana.app/sourcePath"]
			if wanted[sp] {
				result[sp] = SnapshotObject(t, &list.Items[i])
			}
		}
		for _, p := range paths {
			assert.Contains(c, result, p, "dashboard with sourcePath %q not found", p)
		}
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected dashboards for repo %q", repoName)
	return result
}

// RequireDashboardsUpdatedInPlace verifies that the K8s UIDs are preserved
// (i.e., the resources were updated in place, not deleted and recreated)
// for all given paths that appear in both before and after snapshot maps.
func RequireDashboardsUpdatedInPlace(t *testing.T, before, after map[string]ObjectSnapshot, paths []string) {
	t.Helper()
	for _, p := range paths {
		b, okB := before[p]
		a, okA := after[p]
		require.True(t, okB, "before snapshot missing for %q", p)
		require.True(t, okA, "after snapshot missing for %q", p)
		RequireUpdatedInPlace(t, p, b, a)
	}
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

// ── Git-server test infrastructure ─────────────────────────────────────────

// DashboardJSON generates a valid dashboard JSON payload for testing.
func DashboardJSON(uid, title string, version int) []byte {
	dashboard := map[string]interface{}{
		"uid":           uid,
		"title":         title,
		"tags":          []string{},
		"timezone":      "browser",
		"schemaVersion": 39,
		"version":       version,
		"refresh":       "",
		"panels":        []interface{}{},
	}
	data, _ := json.MarshalIndent(dashboard, "", "\t")
	return data
}

type exportRepoInfo struct {
	user   *gittest.User
	remote *gittest.RemoteRepository
}

// GitTestHelper wraps ProvisioningTestHelper with git-specific functionality:
// a shared gittest.Server and helpers for creating/syncing git repositories.
type GitTestHelper struct {
	*ProvisioningTestHelper
	gitServer       *gittest.Server
	exportRepoInfos map[string]*exportRepoInfo
}

// GitServer returns the underlying gittest.Server.
func (h *GitTestHelper) GitServer() *gittest.Server {
	return h.gitServer
}

// NewSharedGitEnv creates a lazily initialized shared Git test environment.
func NewSharedGitEnv(options ...GrafanaOption) *SharedEnv[*GitTestHelper] {
	return &SharedEnv[*GitTestHelper]{
		label:   "shared git server",
		initFn:  runGrafanaWithGitServerShared,
		options: options,
	}
}

// runGrafanaWithGitServerShared is like RunGrafanaWithGitServer but keeps the
// servers alive until the returned shutdown function is called.
func runGrafanaWithGitServerShared(t *testing.T, options ...GrafanaOption) (*GitTestHelper, func()) {
	t.Helper()

	ctx := context.Background()
	gitServer, err := gittest.NewServer(ctx, gittest.WithLogger(gittest.NewWriterLogger(os.Stderr)))
	require.NoError(t, err, "failed to start git server")

	allOpts := append([]GrafanaOption{WithRepositoryTypes([]string{"git"})}, options...)
	helper, serverShutdown := runGrafanaShared(t, allOpts...)

	shutdown := func() {
		if err := gitServer.Cleanup(); err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "failed to cleanup git server: %v\n", err)
		}
		serverShutdown()
	}

	return &GitTestHelper{
		ProvisioningTestHelper: helper,
		gitServer:              gitServer,
		exportRepoInfos:        make(map[string]*exportRepoInfo),
	}, shutdown
}

// CleanupAllResources removes Grafana-managed resources left by a previous
// test. It first waits for active jobs to finish, then delegates to
// ProvisioningTestHelper.CleanupAllResources.
func (h *GitTestHelper) CleanupAllResources(t *testing.T, ctx context.Context) {
	t.Helper()
	h.waitForNoActiveJobs(t)
	h.ProvisioningTestHelper.CleanupAllResources(t, ctx)
}

// CreateGitRepo creates a git repository with sync target "instance" and registers
// it with Grafana provisioning. workflows is optional; defaults to ["write"].
func (h *GitTestHelper) CreateGitRepo(t *testing.T, repoName string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	return h.createGitRepo(t, repoName, "instance", initialFiles, workflows...)
}

// CreateFolderTargetGitRepo creates a git repository with sync target "folder" and
// registers it with Grafana provisioning. Unlike "instance" repos, multiple "folder"
// repos can coexist on the same Grafana server. workflows is optional; defaults to ["write"].
func (h *GitTestHelper) CreateFolderTargetGitRepo(t *testing.T, repoName string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	return h.createGitRepo(t, repoName, "folder", initialFiles, workflows...)
}

func (h *GitTestHelper) createGitRepo(t *testing.T, repoName string, syncTarget string, initialFiles map[string][]byte, workflows ...string) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()

	ctx := context.Background()

	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create user")

	remote, err := h.gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, "failed to create remote repository")

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create local repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	for filePath, content := range initialFiles {
		err = local.CreateFile(filePath, string(content))
		require.NoError(t, err, "failed to create file %s", filePath)
	}

	if len(initialFiles) > 0 {
		_, err = local.Git("add", ".")
		require.NoError(t, err, "failed to add files")
		_, err = local.Git("commit", "-m", "Add initial files")
		require.NoError(t, err, "failed to commit files")
		_, err = local.Git("push")
		require.NoError(t, err, "failed to push files")
	}

	if len(workflows) == 0 {
		workflows = []string{"write"}
	}
	workflowsJSON, err := json.Marshal(workflows)
	require.NoError(t, err)

	repoObj := h.RenderObject(t, TestdataPath("git.json.tmpl"), map[string]any{
		"Name":          repoName,
		"Title":         fmt.Sprintf("Test Repository %s", repoName),
		"URL":           remote.URL,
		"Branch":        "main",
		"TokenUser":     user.Username,
		"SyncTarget":    syncTarget,
		"Token":         user.Password,
		"WorkflowsJSON": string(workflowsJSON),
	})

	_, err = h.Repositories.Resource.Create(ctx, repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create repository")

	h.waitForReadyRepository(t, repoName)

	return remote, local
}

func (h *GitTestHelper) waitForReadyRepository(t *testing.T, repoName string) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "failed to get repository") {
			return
		}

		conditions, found, err := unstructured.NestedSlice(repo.Object, "status", "conditions")
		if !assert.NoError(collect, err) {
			return
		}

		if !found || len(conditions) == 0 {
			collect.Errorf("no conditions found for repository %s", repoName)
			return
		}

		ready := false
		for _, cond := range conditions {
			condMap := cond.(map[string]interface{})
			condType, _ := condMap["type"].(string)
			condStatus, _ := condMap["status"].(string)
			condReason, _ := condMap["reason"].(string)
			condMessage, _ := condMap["message"].(string)

			t.Logf("Repository %s condition: type=%s status=%s reason=%s message=%s",
				repoName, condType, condStatus, condReason, condMessage)

			if condType == "Ready" && condStatus == "True" {
				ready = true
				break
			}
		}

		assert.True(collect, ready, "repository not ready")
	}, WaitTimeoutDefault, WaitIntervalDefault, "repository %s should become ready", repoName)
}

func (h *GitTestHelper) waitForNoActiveJobs(t *testing.T) {
	t.Helper()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		jobs, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(collect, err, "failed to list jobs") {
			return
		}
		assert.Empty(collect, jobs.Items, "jobs still active from previous test")
	}, WaitTimeoutDefault, WaitIntervalDefault, "jobs should complete before cleanup")
}

// RequireRepoDashboardCount asserts the number of dashboards whose
// grafana.app/managerId annotation matches repoName.
func RequireRepoDashboardCount(t *testing.T, h *GitTestHelper, ctx context.Context, repoName string, expected int) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		var count int
		for _, d := range list.Items {
			if mgr, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId"); mgr == repoName {
				count++
			}
		}
		assert.Equal(c, expected, count, "unexpected dashboard count for repo %q", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected %d dashboard(s) for repo %q", expected, repoName)
}

// RequireRepoFolderCount asserts the number of folders whose
// grafana.app/managerId annotation matches repoName.
func RequireRepoFolderCount(t *testing.T, h *GitTestHelper, ctx context.Context, repoName string, expected int) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := h.Folders.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list folders") {
			return
		}
		var count int
		for _, f := range list.Items {
			if mgr, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId"); mgr == repoName {
				count++
			}
		}
		assert.Equal(c, expected, count, "unexpected folder count for repo %q", repoName)
	}, WaitTimeoutDefault, WaitIntervalDefault,
		"expected %d folder(s) for repo %q", expected, repoName)
}

// RequireJobWarningContains asserts that at least one warning in the job status
// contains the given substring.
func RequireJobWarningContains(t *testing.T, jobObj *provisioning.Job, substr string) {
	t.Helper()
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, substr) {
			return
		}
	}
	t.Errorf("expected at least one warning containing %q, got warnings: %v", substr, jobObj.Status.Warnings)
}

// ── Export helpers ──────────────────────────────────────────────────────────

// CreateExportGitRepo creates a git repository configured for export (push)
// workflows: sync disabled, target "instance", workflow "write".
func (h *GitTestHelper) CreateExportGitRepo(t *testing.T, repoName string) {
	t.Helper()

	ctx := context.Background()

	user, err := h.gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create git user")

	remote, err := h.gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, "failed to create remote git repository")

	h.exportRepoInfos[repoName] = &exportRepoInfo{user: user, remote: remote}

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create local git repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	repoObj := h.RenderObject(t, TestdataPath("git.json.tmpl"), map[string]any{
		"Name":          repoName,
		"Title":         repoName,
		"URL":           remote.URL,
		"Branch":        "main",
		"TokenUser":     user.Username,
		"SyncTarget":    "instance",
		"Token":         user.Password,
		"WorkflowsJSON": `["write"]`,
	})

	_, err = h.Repositories.Resource.Create(ctx, repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to register export git repository %q with Grafana", repoName)

	h.waitForReadyRepository(t, repoName)
}

func (h *GitTestHelper) cloneExportRepo(t *testing.T, ctx context.Context, repoName string) (string, func()) {
	t.Helper()
	info, ok := h.exportRepoInfos[repoName]
	if !ok {
		t.Fatalf("repo %q not registered as export repo – call CreateExportGitRepo first", repoName)
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

// GitFileExists reports whether filePath exists on the main branch of an export
// repository. It clones the repo via git (bypassing the provisioning files
// endpoint, which rejects hidden files such as .keep).
func (h *GitTestHelper) GitFileExists(t *testing.T, ctx context.Context, repoName, filePath string) bool {
	t.Helper()
	cloneDir, cleanup := h.cloneExportRepo(t, ctx, repoName)
	defer cleanup()

	_, err := os.Stat(filepath.Join(cloneDir, filePath))
	return err == nil
}

// GitReadFile returns the raw bytes of filePath on the main branch of an export
// repository. It fails the test if the file does not exist.
func (h *GitTestHelper) GitReadFile(t *testing.T, ctx context.Context, repoName, filePath string) []byte {
	t.Helper()
	cloneDir, cleanup := h.cloneExportRepo(t, ctx, repoName)
	defer cleanup()

	data, err := os.ReadFile(filepath.Join(cloneDir, filePath)) //nolint:gosec
	require.NoError(t, err, "file %s not found in git repo %s", filePath, repoName)
	return data
}

// TestGithubPrivateKeyBase64 returns the base64-encoded test RSA private key
//
//nolint:gosec // Test RSA private key (base64-encoded, generated for testing purposes only, never used in production)
func TestGithubPrivateKeyBase64() string {
	return "LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFb1FJQkFBS0NBUUJuMU11TTVoSWZINmQzVE5TdEkxb2ZXdi9nY2pRNGpvaTljRmlqRXdWTHVQWWtGMW5ECktrU2JhTUdGVVdpT1RhQi9IOWZ4bWQvVjJ1MDRObEJZM2F2Nm01VC9zSGZWU2lFV0FFVWJsaDNjQTM0SFZDbUQKY3F5eVZ0eTVITEdKSmxTczJDN1cyeDd5VWM5SW16eURCc3lqcEtPWHVvako5d045YTE3RDJjWVU1V2tYam9EQwo0QkhpZDYxam45V0JUdFBaWFNnT2RpcndhaE56eFpRU0lQN0RBOVQ4eWlad0lXUHA1WWVzZ3NBUHlRTENGUGdNCnM3N3h6L0NFVW5FWVEzNXpJL2svbVFyd0tkUS9aUDh4THdRb2hVSUQwQkl4RTdHNXF1TDA2OVJ1dUNaV1prb0YKb1BpWmJwN0hTcnl6MSsxOWpEM3JGVDdlSEdVWXZBeUNuWG1YQWdNQkFBRUNnZ0VBRFNzNEJjN0lUWm8rS3l0YgpiZm9sM0FRMm44amNSckFOTjdtZ0JFN05SU1ZZVW91RG52VWxibkNDMnQzUVhQd0xkeFFhMTFHa3lnTFNRMmJnCkdlVkRncTFvNEdVSlRjdnhGbEZDY3BVL2hFQU5JL0RRc3hOQVEvNHdVR29MT2xIYU8zSFB2d0JibEhBNzBnR2UKVXgveHBHK2xNQUZBaUIwRUhFd1o0TTBtQ2xCRU9RdjNOemFGVFd1Qkh0SU1TOGVpZDdNMXE1cXo5K3JDZ1pTTApLQkJIbzBPdlViYWpHNENXbDhTTTZMVVlhcEFTR2crVTE3RSs0eEEzbnB3cElkc2srQ2J0WCt2dlgzMjRuNGtuCjBFa3JKcUNqdjhNMUtpQ0tBUCtVeHdQMDB5d3hPZzRQTit4K2RISS9JN3hCdkVLZS94NkJsdFZTZEdBK1BsVUsKMDJ3YWdRS0JnUURGN2dkUUxGSWFnUEg3WDdkQlA2cUVHeGovQ2s5UWR6M1MxZ290UGtWZXErMS9VdFFpallaMQpqNDR1cC8weUIyQjlQNGtXMDkxbitpV2N5Zm9VNVV3QnVhOWRIdkNaUDNRSDA1TFIxWnNjVUh4TEdqRFBCQVN0CmwyeFNxMGhxcU5XQnNwYjFNMGVDWTBZeGk2NWlEa2ozeHNJMmlOMzVCRWIxRmxXZFI1S0d2d0tCZ1FDR1MwY2UKd0FTV2JaSVBVMlVvS0dPUWtJSlU2UW1MeTBLWmJmWWtweWZFOEl4R3R0WVZFUThwdU52REROWldITmYrTFA4NQpjOGlWNlNmbldpTG11MVhrRzJZbUpGQkNDQVdnSjhNcTJYUUQ4RSthL3hjYVczTnFsY0M1K0kyY3pYMzY3ajNyCjY5d1pTeFJielIrRENmT2lJa3Jla0pJbXdOMTgzWll5MmNCYktRS0JnRmo4NklyU01tTzZINUZ0K2owNnU1WkQKZkp5RjdSejNUM053U2drSFd6YnlRNGdnSEVJZ3NSZy8zNlA0WVN6U0JqNnBoeUFkUndrTmZVV2R4WE1KbUgrYQpGVTdmcnpxblBhcWJKQUoxY0JSdDEwUUkxWEx0a3BEZGFKVk9idk9OVHRqT0MzTFlpRWtHQ3pRUlllaXlGWHBaCkFVNTFnSjhKbmtGb3RqdE5SNEtQQW9HQWVoVlJFRGxMY2wwbG5OMFpac3BneVBrMkltNi9pT0E5S1RIM3hCWloKWndXdTRGSXlpSEE3c3BnazRFcDVSMHR0WjlvTUkzU0ljdy9FZ09OR095OHV3L0hNaVB3V0loRWMzQjJKcFJpTwpDVTZiYjdKYWxGRnl1UUJ1ZGlIb3l4VmNZNVBWb3ZXRjMxQ0xyM0RvSnI0VFI5K1k1SC9VL1huellDSW8rdzFOCmV4RUNnWUJGQUdLWVRJZUdBdmhJdkQ1VHBoTHBiQ3llVkxCSXE1aFJ5cmRSWSs2SXdxZHI1UEd2TFBLd2luNSsKKzRDRGhXUFc0c3BxOE1ZUENSaU1ydlJTY3RLdC83RmhWR0wydkUvMFZZM1RjTGsxNHFMQysyKzBsblBWZ25Zbgp1NS93T3l1SHAxY0lCbmplTjQxL3BsdU9XRkJISTl4TFczRXhMdG1ZTWllY0o4VmRSQT09Ci0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0tCg==" // trufflehog:ignore
}

// GetConnectionClientV1Beta1 returns a K8sResourceClient configured for v1beta1 Connections
func GetConnectionClientV1Beta1(helper *apis.K8sTestHelper) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "provisioning.grafana.app",
			Version:  "v1beta1",
			Resource: "connections",
		},
	})
}

// GetRepositoryClientV1Beta1 returns a K8sResourceClient configured for v1beta1 Repositories
func GetRepositoryClientV1Beta1(helper *apis.K8sTestHelper) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "provisioning.grafana.app",
			Version:  "v1beta1",
			Resource: "repositories",
		},
	})
}

// NewDefaultSharedEnv creates a SharedEnv with default options for provisioning tests.
func NewDefaultSharedEnv() *SharedEnv[*ProvisioningTestHelper] {
	return NewSharedEnv(
		func(opts *testinfra.GrafanaOpts) {
			opts.SecretsManagerEnableDBMigrations = true
		},
	)
}

// SharedHelper returns a clean provisioning test helper with a mocked GitHub client.
// This is the standard helper used across provisioning integration tests.
func SharedHelper(t *testing.T, env *SharedEnv[*ProvisioningTestHelper]) *ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

// RESTDo performs a REST request against the provisioning API and returns the
// response as an unstructured map. The subpath is appended to
// /apis/provisioning.grafana.app/<version>/namespaces/<namespace>/.
func (h *ProvisioningTestHelper) RESTDo(method, version, subpath string, body ...map[string]interface{}) (map[string]interface{}, error) {
	ns := h.Namespace
	if ns == "" {
		ns = "default"
	}
	absPath := fmt.Sprintf("/apis/provisioning.grafana.app/%s/namespaces/%s/%s", version, ns, subpath)

	req := h.AdminREST.Verb(method).AbsPath(absPath)
	if len(body) > 0 && body[0] != nil {
		bodyBytes, err := json.Marshal(body[0])
		if err != nil {
			return nil, err
		}
		req = req.Body(bodyBytes).SetHeader("Content-Type", "application/json")
	}

	result := req.Do(context.Background())
	if err := result.Error(); err != nil {
		return nil, err
	}

	raw, err := result.Raw()
	if err != nil {
		return nil, err
	}

	var obj map[string]interface{}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return nil, err
	}
	return obj, nil
}

// LabelPendingDelete is the label key written by the tenant watcher to mark
// resources whose namespace is pending deletion.
const LabelPendingDelete = "cloud.grafana.com/pending-delete"

// SetPendingDeleteLabel adds the pending-delete label to the named resource.
// It retries on 409 Conflict to handle concurrent status updates from the controller.
func SetPendingDeleteLabel(t *testing.T, resource dynamic.ResourceInterface, name string) {
	t.Helper()
	err := RetryOnConflict(t, func() error {
		obj, err := resource.Get(t.Context(), name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		labels := obj.GetLabels()
		if labels == nil {
			labels = make(map[string]string)
		}
		labels[LabelPendingDelete] = "true"
		obj.SetLabels(labels)
		_, err = resource.Update(t.Context(), obj, metav1.UpdateOptions{})
		return err
	})
	require.NoError(t, err, "setting the pending-delete label on %q should be allowed", name)
}

// RetryOnConflict retries fn while it returns a 409 Conflict, using
// EventuallyWithT so the retry window is time-bounded.
func RetryOnConflict(t *testing.T, fn func() error) error {
	t.Helper()
	var lastErr error
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		lastErr = fn()
		if apierrors.IsConflict(lastErr) {
			c.Errorf("conflict error, retrying: %v", lastErr)
		}
	}, WaitTimeoutDefault, 200*time.Millisecond, "operation failed with persistent 409 Conflict")
	return lastErr
}

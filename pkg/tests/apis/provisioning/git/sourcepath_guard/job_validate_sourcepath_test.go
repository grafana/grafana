package sourcepathguard

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/nanogit/gittest"
)

// TestIntegrationProvisioning_DeleteJob_RejectsSourcePathEscapingRepositoryPath
// Ensures `delete` jobs validate the sourcePath annotation for a resource
// Ensures that user cannot delete files outside of the repo's root path and user has permission
// to delete the files that are under the repo's root path
func TestIntegrationProvisioning_DeleteJob_RejectsSourcePathEscapingRepositoryPath(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "deletejob-sourcepath-escape"

	remote, local := createRemoteGitRepoForTest(t, helper, map[string][]byte{
		// In scope: lives under the repository's configured "scope/" path.
		"scope/dashboard.json": common.DashboardJSON("deletejob-escape-dash", "In scope dashboard", 1),
		// Out of scope: lives outside "scope/", at the repository root.
		"outside/secret.txt": []byte("do-not-delete"),
	})

	repoObj := newGitRepositoryObject(repoName, remote.URL, remote.User.Username, remote.User.Password, "scope")
	_, err := helper.Repositories.Resource.Create(t.Context(), repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create git repository")
	helper.WaitForHealthyRepository(t, repoName)

	// Grant the shared Editor user ordinary folder permissions. Nothing
	// admin-only.
	helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"folders:read", "folders:write", "folders:delete"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})

	// Step 1: the Editor creates an ordinary folder they own. It is not
	// managed by any repository - no grafana.app/managedBy is set.
	editorFolders := helper.WithNamespace(t, "default", helper.Org1.Editor).Folders.Resource
	folder := newUnmanagedFolderObject("Escape Folder")
	created, err := editorFolders.Create(t.Context(), folder, metav1.CreateOptions{})
	require.NoError(t, err, "editor should be able to create an ordinary folder")

	// Step 2: the Editor forges the folder's sourcePath annotation to point
	// outside the repository's configured "scope/" path. The guard lives in the
	// job worker, so this write must succeed. If it fails, the test would
	// otherwise pass without ever reaching the guard.
	ann := created.GetAnnotations()
	if ann == nil {
		ann = map[string]string{}
	}
	ann[utils.AnnoKeySourcePath] = "../outside"
	created.SetAnnotations(ann)
	updated, err := editorFolders.Update(t.Context(), created, metav1.UpdateOptions{})
	require.NoError(t, err, "editor should be able to set the sourcePath annotation on their own folder")

	// Step 3: the Editor submits a delete job referencing their own folder by
	// ResourceRef. The job must be accepted and the worker must reject the path.
	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionDelete,
		Delete: &provisioning.DeleteJobOptions{
			Resources: []provisioning.ResourceRef{
				{Group: "folder.grafana.app", Kind: "Folder", Name: updated.GetName()},
			},
		},
	})

	result := helper.EditorREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	obj, err := result.Get()
	require.NoError(t, err, "editor should be able to submit the delete job")
	jobObj, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected the job to be an unstructured object, got %T", obj)

	requireJobRejectedUnsafeSourcePath(t, awaitJobDone(t, helper, jobObj))

	// The security invariant: a file outside the repository's configured path
	// must survive.
	_, err = local.Git("fetch", "origin")
	require.NoError(t, err, "failed to fetch from remote")

	_, err = local.Git("show", "origin/main:outside/secret.txt")
	require.NoError(t, err,
		"a forged grafana.app/sourcePath annotation on an unmanaged Folder let an Editor delete 'outside/secret.txt', a file outside the repository's configured 'scope/' path")

	_, err = local.Git("show", "origin/main:scope/dashboard.json")
	require.NoError(t, err, "in-scope file should be unaffected")
}

// TestIntegrationProvisioning_MoveJob_RejectsSourcePathEscapingRepositoryPath
// is the move-job counterpart to
// TestIntegrationProvisioning_DeleteJob_RejectsSourcePathEscapingRepositoryPath.
//
// The move job worker resolves ResourceRef (derived from the grafana.app/sourcePath annotation)
// entries to a file path and then passes that
// path as the *source* of rw.Move. This test prevents a user with Editor role
// moving a git tree from outside the repository's configured `path`
// into the managed/sync area.
func TestIntegrationProvisioning_MoveJob_RejectsSourcePathEscapingRepositoryPath(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "movejob-sourcepath-escape"

	remote, local := createRemoteGitRepoForTest(t, helper, map[string][]byte{
		// In scope: lives under the repository's configured "scope/" path.
		"scope/dashboard.json": common.DashboardJSON("movejob-escape-dash", "In scope dashboard", 1),
		// Out of scope: lives outside "scope/", at the repository root.
		"outside/secret.txt": []byte("do-not-move"),
	})

	repoObj := newGitRepositoryObject(repoName, remote.URL, remote.User.Username, remote.User.Password, "scope")
	_, err := helper.Repositories.Resource.Create(t.Context(), repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create git repository")
	helper.WaitForHealthyRepository(t, repoName)

	// Grant the shared Editor user ordinary folder permissions. Move by
	// ResourceRef is authorized as folders:write (VerbUpdate), not
	// folders:delete.
	helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"folders:read", "folders:write"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})

	// Step 1: the Editor creates an ordinary folder they own. It is not
	// managed by any repository - no grafana.app/managedBy is set.
	editorFolders := helper.WithNamespace(t, "default", helper.Org1.Editor).Folders.Resource
	folder := newUnmanagedFolderObject("Escape Folder (move)")
	created, err := editorFolders.Create(t.Context(), folder, metav1.CreateOptions{})
	require.NoError(t, err, "editor should be able to create an ordinary folder")

	// Step 2: the Editor forges the folder's sourcePath annotation to point
	// outside the repository's configured "scope/" path. The guard lives in the
	// job worker, so this write must succeed. If it fails, the test would
	// otherwise pass without ever reaching the guard.
	ann := created.GetAnnotations()
	if ann == nil {
		ann = map[string]string{}
	}
	ann[utils.AnnoKeySourcePath] = "../outside"
	created.SetAnnotations(ann)
	updated, err := editorFolders.Update(t.Context(), created, metav1.UpdateOptions{})
	require.NoError(t, err, "editor should be able to set the sourcePath annotation on their own folder")

	// Step 3: the Editor submits a move job referencing their own folder by
	// ResourceRef, targeting a directory inside the repository's configured
	// "scope/" path. The job must be accepted and the worker must reject the path.
	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionMove,
		Move: &provisioning.MoveJobOptions{
			TargetPath: "moved/",
			Resources: []provisioning.ResourceRef{
				{Group: "folder.grafana.app", Kind: "Folder", Name: updated.GetName()},
			},
		},
	})

	result := helper.EditorREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())

	obj, err := result.Get()
	require.NoError(t, err, "editor should be able to submit the move job")
	jobObj, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected the job to be an unstructured object, got %T", obj)

	requireJobRejectedUnsafeSourcePath(t, awaitJobDone(t, helper, jobObj))

	// The security invariant: a file outside the repository's configured path
	// must neither disappear from its original location nor land inside the
	// configured path at the move destination.
	_, err = local.Git("fetch", "origin")
	require.NoError(t, err, "failed to fetch from remote")

	_, err = local.Git("show", "origin/main:outside/secret.txt")
	require.NoError(t, err,
		"a forged grafana.app/sourcePath annotation on an unmanaged Folder let an Editor move 'outside/secret.txt', a file outside the repository's configured 'scope/' path, out of its original location")

	_, err = local.Git("show", "origin/main:scope/moved/outside/secret.txt")
	require.Error(t, err,
		"the out-of-scope file was relocated into the repository's configured 'scope/' path")

	_, err = local.Git("show", "origin/main:scope/dashboard.json")
	require.NoError(t, err, "in-scope file should be unaffected")
}

// createRemoteGitRepoForTest creates a bare git remote and a local clone
// with the given initial files committed and pushed. It is a minimal,
// version-stable stand-in for helper.CreateRemoteGitRepo (not present on
// every supported branch), built only from gittest.Server (helper.GitServer)
// and the external, stable github.com/grafana/nanogit/gittest package.
func createRemoteGitRepoForTest(t *testing.T, helper *common.GitTestHelper, initialFiles map[string][]byte) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()

	user, err := helper.GitServer().CreateUser(t.Context())
	require.NoError(t, err, "failed to create git test user")

	remote, err := helper.GitServer().CreateRepo(t.Context(), "repo", user)
	require.NoError(t, err, "failed to create remote repository")

	local, err := gittest.NewLocalRepo(t.Context())
	require.NoError(t, err, "failed to create local repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	for filePath, content := range initialFiles {
		require.NoError(t, local.CreateFile(filePath, string(content)), "failed to create file %s", filePath)
	}

	if len(initialFiles) > 0 {
		_, err = local.Git("add", ".")
		require.NoError(t, err, "failed to add files")
		_, err = local.Git("commit", "-m", "Add initial files")
		require.NoError(t, err, "failed to commit files")
		_, err = local.Git("push")
		require.NoError(t, err, "failed to push files")
	}

	return remote, local
}

// newGitRepositoryObject builds a provisioning Repository object for a git
// repository with a configured subdirectory path, without depending on a
// template file (testdata/git.json.tmpl does not exist on every supported
// branch).
func newGitRepositoryObject(name, url, tokenUser, token, path string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"title":       "Test Repository " + name,
				"description": "Integration test repository for " + name,
				"type":        "git",
				"git": map[string]interface{}{
					"url":       url,
					"branch":    "main",
					"path":      path,
					"tokenUser": tokenUser,
				},
				"sync": map[string]interface{}{
					"enabled":         false,
					"target":          "instance",
					"intervalSeconds": 60,
				},
				"workflows": []interface{}{"write"},
			},
			"secure": map[string]interface{}{
				"token": map[string]interface{}{
					"create": token,
				},
			},
		},
	}
}

// newUnmanagedFolderObject builds a plain Folder object with no manager
// annotations, without depending on common.NewUnmanagedFolder (not present
// on every supported branch).
func newUnmanagedFolderObject(title string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata": map[string]interface{}{
				"generateName": "escape-folder-",
				"namespace":    "default",
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
}

// awaitJobDone waits for the job to finish (success or failure) without
// depending on helper.AwaitJob/AwaitJobSuccess, whose signature differs
// across supported branches. It mirrors their shared underlying mechanism:
// poll the jobs subresource by UID until it is found (jobs are archived to
// historicjobs once complete, so a later NotFound also ends the wait).
func awaitJobDone(t *testing.T, helper *common.GitTestHelper, job *unstructured.Unstructured) *unstructured.Unstructured {
	t.Helper()

	repo := job.GetLabels()[jobs.LabelRepository]
	require.NotEmpty(t, repo)

	var finished *unstructured.Unstructured
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := helper.Repositories.Resource.Get(context.Background(), repo, metav1.GetOptions{},
			"jobs", string(job.GetUID()))

		if !assert.False(collect, apierrors.IsNotFound(err)) {
			collect.Errorf("job %q not found, still waiting for it to complete", job.GetName())
			return
		}
		if !assert.NoError(collect, err, "failed to get job %q", job.GetName()) {
			return
		}
		finished = result
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	require.NotNil(t, finished, "expected a finished job")
	return finished
}

// requireJobRejectedUnsafeSourcePath fails unless the job ended in error
// because the worker refused the unsafe sourcePath. Any other failure, such
// as an authorization or server error, must not pass as a guard hit.
func requireJobRejectedUnsafeSourcePath(t *testing.T, job *unstructured.Unstructured) {
	t.Helper()

	state := common.MustNestedString(job.Object, "status", "state")
	message := common.MustNestedString(job.Object, "status", "message")
	jobErrors := common.MustNestedStringSlice(job.Object, "status", "errors")

	require.Equal(t, string(provisioning.JobStateError), state,
		"job should fail (message: %q, errors: %v)", message, jobErrors)

	found := strings.Contains(message, "unsafe source path")
	for _, e := range jobErrors {
		found = found || strings.Contains(e, "unsafe source path")
	}
	require.True(t, found,
		"job failed, but not because of the sourcePath guard (message: %q, errors: %v)", message, jobErrors)
}

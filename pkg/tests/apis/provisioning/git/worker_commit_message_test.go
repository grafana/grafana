package git

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// These tests verify that JobSpec.Message is used as the git commit subject for
// each commit-producing worker (delete, move, export,
// migrate).

func TestIntegrationGit_DeleteJob_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName = "delete-commit-msg"
		dashUID  = "delete-msg-dash"
		dashFn   = "dashboard.json"
	)

	_, local := helper.CreateExportGitRepo(t, repoName, map[string][]byte{
		dashFn: common.DashboardJSON(dashUID, "Dashboard to delete", 1),
	})
	helper.SyncAndWait(t, repoName)

	const expectedMessage = "Delete dashboard via JobSpec"
	helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action:  provisioning.JobActionDelete,
		Message: expectedMessage,
		Delete: &provisioning.DeleteJobOptions{
			Paths: []string{dashFn},
		},
	})

	require.Equal(t, expectedMessage, common.LatestCommitSubject(t, local, "main"))

	// TODO Fcai
	require.False(t, helper.GitFileExists(t, repoName, dashFn),
		"deleted file should be gone from the remote")
}

func TestIntegrationGit_MoveJob_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName = "move-commit-msg"
		dashUID  = "move-msg-dash"
		dashFn   = "dashboard.json"
	)

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		dashFn: common.DashboardJSON(dashUID, "Dashboard to move", 1),
	})
	helper.SyncAndWait(t, repoName)

	const expectedMessage = "Move dashboard via JobSpec"
	helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action:  provisioning.JobActionMove,
		Message: expectedMessage,
		Move: &provisioning.MoveJobOptions{
			Paths:      []string{dashFn},
			TargetPath: "moved/",
		},
	})

	require.Equal(t, expectedMessage, common.LatestCommitSubject(t, local, "main"))
}

func TestIntegrationGit_ExportJob_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "export-commit-msg"

	// Seed an unmanaged dashboard in storage so the export job has something to push.
	dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(t.Context(), dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")
	t.Cleanup(func() {
		cleanupCtx := context.WithoutCancel(t.Context())
		_ = helper.DashboardsV1.Resource.Delete(cleanupCtx, dash.GetName(), metav1.DeleteOptions{})
	})

	_, local := helper.CreateGitRepo(t, repoName, nil)

	const expectedMessage = "Export dashboards via JobSpec"
	helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action:  provisioning.JobActionPush,
		Message: expectedMessage,
		Push:    &provisioning.ExportJobOptions{},
	})

	require.Equal(t, expectedMessage, common.LatestCommitSubject(t, local, "main"))
}

func TestIntegrationGit_MigrateJob_CommitMessage(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "migrate-commit-msg"

	// Seed an unmanaged dashboard in storage so migration has something to take over.
	dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(t.Context(), dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")
	t.Cleanup(func() {
		cleanupCtx := context.WithoutCancel(t.Context())
		_ = helper.DashboardsV1.Resource.Delete(cleanupCtx, dash.GetName(), metav1.DeleteOptions{})
	})

	_, local := helper.CreateGitRepo(t, repoName, nil)

	// The inner ExportJobOptions.Message is the deprecated fallback; JobSpec.Message
	// must take precedence and appear as the commit subject.
	const expectedMessage = "Migrate via JobSpec"
	helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action:  provisioning.JobActionMigrate,
		Message: expectedMessage,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "deprecated fallback that should be ignored",
		},
	})

	require.Equal(t, expectedMessage, common.LatestCommitSubject(t, local, "main"))
}

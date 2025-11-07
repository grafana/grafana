package jobs

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestValidateJob(t *testing.T) {
	tests := []struct {
		name          string
		job           *provisioning.Job
		wantErr       bool
		validateError func(t *testing.T, err error)
	}{
		{
			name: "valid pull job",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPull,
					Repository: "test-repo",
					Pull: &provisioning.SyncJobOptions{
						Incremental: true,
					},
				},
			},
			wantErr: false,
		},
		{
			name: "missing action",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.action: Required value")
			},
		},
		{
			name: "invalid action",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobAction("invalid"),
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.action: Invalid value")
			},
		},
		{
			name: "missing repository",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPull,
					Pull: &provisioning.SyncJobOptions{
						Incremental: true,
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.repository: Required value")
			},
		},
		{
			name: "pull action without pull options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPull,
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.pull: Required value")
			},
		},
		{
			name: "push action without push options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push: Required value")
			},
		},
		{
			name: "valid push job with valid branch",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Branch:  "main",
						Message: "Test commit",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "push job with invalid branch name",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Branch:  "feature..branch", // Invalid: contains consecutive dots
						Message: "Test commit",
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.branch")
				require.Contains(t, err.Error(), "invalid git branch name")
			},
		},
		{
			name: "push job with invalid path",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Path:    "../../../etc/passwd", // Invalid: path traversal
						Message: "Test commit",
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.path")
			},
		},
		{
			name: "delete action without options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.delete: Required value")
			},
		},
		{
			name: "delete action without paths or resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
					Delete:     &provisioning.DeleteJobOptions{},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "at least one path or resource must be specified")
			},
		},
		{
			name: "valid delete action with paths",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
					Delete: &provisioning.DeleteJobOptions{
						Paths: []string{"dashboard.json", "folder/other.json"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid delete action with resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
					Delete: &provisioning.DeleteJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name: "my-dashboard",
								Kind: "Dashboard",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "delete action with invalid path",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
					Delete: &provisioning.DeleteJobOptions{
						Paths: []string{"../../etc/passwd"}, // Invalid: path traversal
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.delete.paths[0]")
			},
		},
		{
			name: "delete action with resource missing name",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
					Delete: &provisioning.DeleteJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Kind: "Dashboard",
							},
						},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.delete.resources[0].name")
			},
		},
		{
			name: "move action without options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.move: Required value")
			},
		},
		{
			name: "move action without paths or resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						TargetPath: "new-location/",
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "at least one path or resource must be specified")
			},
		},
		{
			name: "move action without target path",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Paths: []string{"dashboard.json"},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.move.targetPath: Required value")
			},
		},
		{
			name: "valid move action",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Paths:      []string{"old-location/dashboard.json"},
						TargetPath: "new-location/",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "move action with invalid target path",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Paths:      []string{"dashboard.json"},
						TargetPath: "../../../etc/", // Invalid: path traversal
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.move.targetPath")
			},
		},
		{
			name: "valid migrate job",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						History: true,
						Message: "Migrate from legacy",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid pr job",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPullRequest,
					Repository: "test-repo",
					PullRequest: &provisioning.PullRequestJobOptions{
						PR:  123,
						Ref: "refs/pull/123/head",
					},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateJob(tt.job)
			if tt.wantErr {
				require.Error(t, err)
				if tt.validateError != nil {
					tt.validateError(t, err)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

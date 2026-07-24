package jobs

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	authlib "github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestValidateJob(t *testing.T) {
	tests := []struct {
		name               string
		job                *provisioning.Job
		supportedResources []provisioning.SupportedResource
		wantErr            bool
		validateError      func(t *testing.T, err error)
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
						Message: "Migrate from unified",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid migrate job with resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{
							{Name: "dash-1", Kind: "Dashboard"},
							{Name: "dash-2", Kind: "Dashboard", Group: "dashboard.grafana.app"},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid migrate job with valid branch",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate:    &provisioning.MigrateJobOptions{Branch: "feature-x"},
				},
			},
			wantErr: false,
		},
		{
			name: "migrate job with invalid branch name",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate:    &provisioning.MigrateJobOptions{Branch: "feature..branch"}, // Invalid: consecutive dots
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.branch")
				require.Contains(t, err.Error(), "invalid git branch name")
			},
		},
		{
			name: "migrate action with resource missing name",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{{Kind: "Dashboard"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.resources[0].name")
			},
		},
		{
			name: "migrate action with resource missing kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "dash-1"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.resources[0].kind")
			},
		},
		{
			name: "migrate action with non-Dashboard kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "folder-1", Kind: "Folder"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.resources[0].kind")
				require.Contains(t, err.Error(), "kind is not supported for export")
			},
		},
		{
			name: "migrate action with non-dashboard group",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "dash-1", Kind: "Dashboard", Group: "folder.grafana.app"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.resources[0].group")
			},
		},
		{
			name: "migrate action without migrate options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate: Required value")
			},
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
		{
			name: "delete action with resource missing kind",
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
							},
						},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.delete.resources[0].kind")
			},
		},
		{
			name: "move action with valid resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name: "my-dashboard",
								Kind: "Dashboard",
							},
						},
						TargetPath: "new-location/",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "move action with resource missing kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Resources: []provisioning.ResourceRef{
							{
								Name: "my-dashboard",
							},
						},
						TargetPath: "new-location/",
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.move.resources[0].kind")
			},
		},
		{
			name: "move action with both paths and resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Paths: []string{"dashboard.json"},
						Resources: []provisioning.ResourceRef{
							{
								Name: "my-dashboard",
								Kind: "Dashboard",
							},
						},
						TargetPath: "new-location/",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "move action with invalid source path",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMove,
					Repository: "test-repo",
					Move: &provisioning.MoveJobOptions{
						Paths:      []string{"../invalid/path"},
						TargetPath: "valid/target/",
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.move.paths[0]")
			},
		},
		{
			name: "delete action with both paths and resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDelete,
					Repository: "test-repo",
					Delete: &provisioning.DeleteJobOptions{
						Paths: []string{"dashboard.json"},
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
			name: "valid push job with resources",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{
							{Name: "dash-1", Kind: "Dashboard"},
							{Name: "dash-2", Kind: "Dashboard", Group: "dashboard.grafana.app"},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "push action with resource missing name",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{{Kind: "Dashboard"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].name")
			},
		},
		{
			name: "push action with resource missing kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "dash-1"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].kind")
			},
		},
		{
			name: "push action with non-Dashboard kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "folder-1", Kind: "Folder"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].kind")
				require.Contains(t, err.Error(), "kind is not supported for export")
			},
		},
		{
			name: "push action with non-dashboard group",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "dash-1", Kind: "Dashboard", Group: "folder.grafana.app"}},
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].group")
			},
		},
		{
			name: "push action with configured non-dashboard kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{
							{Name: "pl-1", Kind: "Playlist"},
							{Name: "pl-2", Kind: "Playlist", Group: "playlist.grafana.app"},
						},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "playlist.grafana.app", Kind: "Playlist"},
			},
			wantErr: false,
		},
		{
			name: "migrate action with configured non-dashboard kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "pl-1", Kind: "Playlist", Group: "playlist.grafana.app"}},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "playlist.grafana.app", Kind: "Playlist"},
			},
			wantErr: false,
		},
		{
			name: "push action with kind absent from configured set",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "dash-1", Kind: "Dashboard"}},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "playlist.grafana.app", Kind: "Playlist"},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].kind")
				require.Contains(t, err.Error(), "kind is not supported for export")
			},
		},
		{
			name: "push action with disabled supported kind is rejected",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "pl-1", Kind: "Playlist"}},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "playlist.grafana.app", Kind: "Playlist", Disabled: true},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].kind")
			},
		},
		{
			name: "migrate action with wrong group for configured kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: []provisioning.ResourceRef{{Name: "pl-1", Kind: "Playlist", Group: "wrong.grafana.app"}},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "playlist.grafana.app", Kind: "Playlist"},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.resources[0].group")
			},
		},
		{
			name: "push action with valid path",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Path:    "some/valid/path",
						Message: "Test commit",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid fix-folder-metadata job without options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionFixFolderMetadata,
					Repository: "test-repo",
				},
			},
			wantErr: false,
		},
		{
			name: "valid releaseResources job",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionReleaseResources,
					Repository: "test-repo",
				},
			},
			wantErr: false,
		},
		{
			name: "valid deleteResources job",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionDeleteResources,
					Repository: "test-repo",
				},
			},
			wantErr: false,
		},
		{
			name: "valid fix-folder-metadata job with options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-job",
				},
				Spec: provisioning.JobSpec{
					Action:            provisioning.JobActionFixFolderMetadata,
					Repository:        "test-repo",
					FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
				},
			},
			wantErr: false,
		},
		{
			name: "push action at the selective export limit",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: makeDashboardRefs(MaxSelectiveExportResources),
					},
				},
			},
			wantErr: false,
		},
		{
			name: "push action over the selective export limit",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: "test-repo",
					Push: &provisioning.ExportJobOptions{
						Resources: makeDashboardRefs(MaxSelectiveExportResources + 1),
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources")
				require.Contains(t, err.Error(), "must have at most 100 items")
			},
		},
		{
			name: "migrate action over the selective export limit",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: "test-repo",
					Migrate: &provisioning.MigrateJobOptions{
						Resources: makeDashboardRefs(MaxSelectiveExportResources + 1),
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.migrate.resources")
				require.Contains(t, err.Error(), "must have at most 100 items")
			},
		},
		{
			name: "valid test job",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test:       &provisioning.TestJobOptions{Duration: metav1.Duration{Duration: 10 * time.Second}},
				},
			},
			wantErr: false,
		},
		{
			name: "test action without test options",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.test: Required value")
			},
		},
		{
			name: "test action with non-positive duration",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test:       &provisioning.TestJobOptions{Duration: metav1.Duration{Duration: 0}},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.test.duration")
				require.Contains(t, err.Error(), "must be positive")
			},
		},
		{
			name: "test action over the duration cap",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test:       &provisioning.TestJobOptions{Duration: metav1.Duration{Duration: MaxTestJobDuration + time.Second}},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.test.duration")
				require.Contains(t, err.Error(), "must not exceed")
			},
		},
		{
			name: "test action with negative progress updates",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test: &provisioning.TestJobOptions{
						Duration:        metav1.Duration{Duration: 10 * time.Second},
						ProgressUpdates: -1,
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.test.progressUpdates")
				require.Contains(t, err.Error(), "must be non-negative")
			},
		},
		{
			name: "test action with progress updates too dense for duration",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test: &provisioning.TestJobOptions{
						// 1s / 100 updates = 10ms apart, far below the throttle.
						Duration:        metav1.Duration{Duration: time.Second},
						ProgressUpdates: 100,
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.test.progressUpdates")
				require.Contains(t, err.Error(), "at least")
			},
		},
		{
			name: "test action with progress updates exactly at the throttle floor",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test: &provisioning.TestJobOptions{
						// 10s / 20 updates = 500ms apart, exactly deliverable.
						Duration:        metav1.Duration{Duration: 10 * time.Second},
						ProgressUpdates: 20,
					},
				},
			},
			wantErr: false,
		},
		{
			name: "test action over progress updates cap",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test: &provisioning.TestJobOptions{
						Duration:        metav1.Duration{Duration: 10 * time.Second},
						ProgressUpdates: MaxTestJobProgressUpdates + 1,
					},
				},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.test.progressUpdates")
				require.Contains(t, err.Error(), "must not exceed")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateJob(tt.job, tt.supportedResources)
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

func TestAdmissionValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		obj             interface{}
		operation       admission.Operation
		perfEnabled     bool
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "valid job passes validation",
			obj: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPull,
					Repository: "test-repo",
					Pull:       &provisioning.SyncJobOptions{Incremental: true},
				},
			},
			operation:   admission.Create,
			perfEnabled: true,
			wantErr:     false,
		},
		{
			name: "test job is rejected when performance flag is disabled",
			obj: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test:       &provisioning.TestJobOptions{Duration: metav1.Duration{Duration: 10 * time.Second}},
				},
			},
			operation:       admission.Create,
			perfEnabled:     false,
			wantErr:         true,
			wantErrContains: "provisioning.performance feature flag",
		},
		{
			name: "test job passes when performance flag is enabled",
			obj: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionTest,
					Repository: "test-repo",
					Test:       &provisioning.TestJobOptions{Duration: metav1.Duration{Duration: 10 * time.Second}},
				},
			},
			operation:   admission.Create,
			perfEnabled: true,
			wantErr:     false,
		},
		{
			name: "invalid job fails validation",
			obj: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					// Missing action
					Repository: "test-repo",
				},
			},
			operation:   admission.Create,
			perfEnabled: true,
			wantErr:     true,
		},
		{
			name:        "returns nil for nil object",
			obj:         nil,
			perfEnabled: true,
			wantErr:     false,
		},
		{
			name: "returns error for non-job object",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			operation:       admission.Create,
			perfEnabled:     true,
			wantErr:         true,
			wantErrContains: "expected job",
		},
		{
			name: "skips validation for objects being deleted",
			obj: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-job",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.JobSpec{
					// Invalid - missing action
					Repository: "test-repo",
				},
			},
			operation:   admission.Update,
			perfEnabled: true,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := NewAdmissionValidator(nil, func(context.Context) bool { return tt.perfEnabled })

			var obj runtime.Object
			if tt.obj != nil {
				obj = tt.obj.(runtime.Object)
			}

			attr := newAdmissionTestAttributes(obj, tt.operation)

			err := v.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					require.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func newAdmissionTestAttributes(obj runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		nil,
		provisioning.JobResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.JobResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestHistoricJobAdmissionValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		obj             interface{}
		operation       admission.Operation
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "valid historic job passes validation",
			obj: &provisioning.HistoricJob{
				ObjectMeta: metav1.ObjectMeta{Name: "test-historic-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPull,
					Repository: "test-repo",
				},
			},
			operation: admission.Create,
			wantErr:   false,
		},
		{
			name: "historic job missing action fails validation",
			obj: &provisioning.HistoricJob{
				ObjectMeta: metav1.ObjectMeta{Name: "test-historic-job"},
				Spec: provisioning.JobSpec{
					Repository: "test-repo",
				},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "action must be specified",
		},
		{
			name: "historic job missing repository fails validation",
			obj: &provisioning.HistoricJob{
				ObjectMeta: metav1.ObjectMeta{Name: "test-historic-job"},
				Spec: provisioning.JobSpec{
					Action: provisioning.JobActionPull,
				},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "repository must be specified",
		},
		{
			name:    "returns nil for nil object",
			obj:     nil,
			wantErr: false,
		},
		{
			name: "returns error for non-historic-job object",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test"},
			},
			operation:       admission.Create,
			wantErr:         true,
			wantErrContains: "expected historic job",
		},
		{
			name: "skips validation for objects being deleted",
			obj: &provisioning.HistoricJob{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "test-historic-job",
					DeletionTimestamp: &metav1.Time{Time: time.Now()},
				},
				Spec: provisioning.JobSpec{
					// Invalid - missing action and repository
				},
			},
			operation: admission.Update,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := NewHistoricJobAdmissionValidator()

			var obj runtime.Object
			if tt.obj != nil {
				obj = tt.obj.(runtime.Object)
			}

			attr := newHistoricJobAdmissionTestAttributes(obj, tt.operation)

			err := v.Validate(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					require.Contains(t, err.Error(), tt.wantErrContains)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

// makeDashboardRefs builds n valid dashboard resource refs for limit tests.
func makeDashboardRefs(n int) []provisioning.ResourceRef {
	refs := make([]provisioning.ResourceRef, n)
	for i := range refs {
		refs[i] = provisioning.ResourceRef{Name: fmt.Sprintf("dash-%d", i), Kind: "Dashboard"}
	}
	return refs
}

func newHistoricJobAdmissionTestAttributes(obj runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		nil,
		provisioning.HistoricJobResourceInfo.GroupVersionKind(),
		"default",
		"test",
		provisioning.HistoricJobResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

// fakeProvisioningAuthInfo embeds StaticRequester to satisfy the Requester
// interface while overriding the audience, so the token-audience branch of
// IsProvisioningServiceIdentity can be exercised.
type fakeProvisioningAuthInfo struct {
	*identity.StaticRequester
	audience []string
}

func (f fakeProvisioningAuthInfo) GetAudience() []string { return f.audience }

func TestValidateAuthor(t *testing.T) {
	requester := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		Name:    "Test User",
		Email:   "test@example.com",
		UserUID: "abc123",
	}
	userCtx := identity.WithRequester(t.Context(), requester)
	serviceCtx, _, err := identity.WithProvisioningIdentity(t.Context(), "default")
	require.NoError(t, err)
	audienceCtx := identity.WithRequester(t.Context(), fakeProvisioningAuthInfo{
		StaticRequester: &identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "42"},
		audience:        []string{"provisioning.grafana.app"},
	})

	annotations := map[string]string{
		AnnoAuthor:       requester.GetName(),
		AnnoAuthorEmail:  requester.GetEmail(),
		AnnoAuthorID:     requester.GetUID(),
		AnnoAuthorOrigin: "Grafana",
	}

	tests := []struct {
		name            string
		ctx             context.Context
		operation       admission.Operation
		annotations     map[string]string
		oldAnnotations  map[string]string
		wantErrContains string
	}{
		{
			name:        "create without annotations",
			ctx:         userCtx,
			operation:   admission.Create,
			annotations: nil,
		},
		{
			name:        "create by service identity",
			ctx:         serviceCtx,
			operation:   admission.Create,
			annotations: map[string]string{AnnoAuthor: "someone else"},
		},
		{
			name:        "create with matching annotations",
			ctx:         userCtx,
			operation:   admission.Create,
			annotations: annotations,
		},
		{
			name:            "create with mismatched name",
			ctx:             userCtx,
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: "someone else", AnnoAuthorEmail: requester.GetEmail(), AnnoAuthorID: requester.GetUID()},
			wantErrContains: AnnoAuthor + " must match",
		},
		{
			name:            "create with mismatched email",
			ctx:             userCtx,
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: requester.GetName(), AnnoAuthorEmail: "other@example.com", AnnoAuthorID: requester.GetUID()},
			wantErrContains: AnnoAuthorEmail + " must match",
		},
		{
			name:            "create with a missing author field",
			ctx:             userCtx,
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: requester.GetName()},
			wantErrContains: AnnoAuthorEmail + " must match",
		},
		{
			name:            "create by the provisioning identity with an email",
			ctx:             serviceCtx,
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: "grot", AnnoAuthorEmail: "grot@example.com"},
			wantErrContains: AnnoAuthorEmail + " may not be set by the provisioning service",
		},
		{
			name:        "create by audience-based provisioning identity",
			ctx:         audienceCtx,
			operation:   admission.Create,
			annotations: map[string]string{AnnoAuthor: "grot", AnnoAuthorID: "123", AnnoAuthorOrigin: "github"},
		},
		{
			name:            "create with mismatched id",
			ctx:             userCtx,
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: requester.GetName(), AnnoAuthorEmail: requester.GetEmail(), AnnoAuthorID: "user:someone-else"},
			wantErrContains: AnnoAuthorID + " must match",
		},
		{
			name:            "create without requester",
			ctx:             t.Context(),
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: "Test User"},
			wantErrContains: "may only be set by a user or the provisioning service",
		},
		{
			name: "create by another service identity",
			ctx: identity.WithRequester(t.Context(), &identity.StaticRequester{
				Type:    authlib.TypeAccessPolicy,
				UserUID: "search",
			}),
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthor: "grot"},
			wantErrContains: "may only be set by a user or the provisioning service",
		},
		{
			name:            "create by a user with only an origin",
			ctx:             userCtx,
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthorOrigin: "github"},
			wantErrContains: AnnoAuthor + " must match",
		},
		{
			name:            "create with a spoofed origin and no requester",
			ctx:             t.Context(),
			operation:       admission.Create,
			annotations:     map[string]string{AnnoAuthorOrigin: "github"},
			wantErrContains: AnnoAuthorOrigin + " must be Unknown",
		},
		{
			name:        "create with only an origin and no requester is allowed",
			ctx:         t.Context(),
			operation:   admission.Create,
			annotations: map[string]string{AnnoAuthorOrigin: "Unknown"},
		},
		{
			name:           "update with unchanged annotations",
			ctx:            userCtx,
			operation:      admission.Update,
			annotations:    annotations,
			oldAnnotations: annotations,
		},
		{
			name:            "update changing name",
			ctx:             userCtx,
			operation:       admission.Update,
			annotations:     map[string]string{AnnoAuthor: "someone else", AnnoAuthorEmail: requester.GetEmail(), AnnoAuthorID: requester.GetUID(), AnnoAuthorOrigin: "Grafana"},
			oldAnnotations:  annotations,
			wantErrContains: AnnoAuthor + " is immutable",
		},
		{
			name:            "update changing email",
			ctx:             userCtx,
			operation:       admission.Update,
			annotations:     map[string]string{AnnoAuthor: requester.GetName(), AnnoAuthorEmail: "other@example.com", AnnoAuthorID: requester.GetUID(), AnnoAuthorOrigin: "Grafana"},
			oldAnnotations:  annotations,
			wantErrContains: AnnoAuthorEmail + " is immutable",
		},
		{
			name:            "update removing email",
			ctx:             userCtx,
			operation:       admission.Update,
			annotations:     map[string]string{AnnoAuthor: requester.GetName(), AnnoAuthorID: requester.GetUID(), AnnoAuthorOrigin: "Grafana"},
			oldAnnotations:  annotations,
			wantErrContains: AnnoAuthorEmail + " is immutable",
		},
		{
			name:            "update changing id",
			ctx:             userCtx,
			operation:       admission.Update,
			annotations:     map[string]string{AnnoAuthor: requester.GetName(), AnnoAuthorEmail: requester.GetEmail(), AnnoAuthorID: "user:someone-else", AnnoAuthorOrigin: "Grafana"},
			oldAnnotations:  annotations,
			wantErrContains: AnnoAuthorID + " is immutable",
		},
		{
			name:            "update changing origin",
			ctx:             userCtx,
			operation:       admission.Update,
			annotations:     map[string]string{AnnoAuthor: requester.GetName(), AnnoAuthorEmail: requester.GetEmail(), AnnoAuthorID: requester.GetUID(), AnnoAuthorOrigin: "GitHub"},
			oldAnnotations:  annotations,
			wantErrContains: AnnoAuthorOrigin + " is immutable",
		},
		{
			name:        "delete is ignored",
			ctx:         userCtx,
			operation:   admission.Delete,
			annotations: map[string]string{AnnoAuthor: "someone else"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Name: "test-job", Annotations: tt.annotations}}
			var oldObj runtime.Object
			if tt.oldAnnotations != nil {
				oldObj = &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Name: "test-job", Annotations: tt.oldAnnotations}}
			}
			attr := admission.NewAttributesRecord(
				job,
				oldObj,
				provisioning.JobResourceInfo.GroupVersionKind(),
				"default",
				"test-job",
				provisioning.JobResourceInfo.GroupVersionResource(),
				"",
				tt.operation,
				nil,
				false,
				&user.DefaultInfo{},
			)

			err := validateAuthor(tt.ctx, attr, job)
			if tt.wantErrContains != "" {
				require.ErrorContains(t, err, tt.wantErrContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

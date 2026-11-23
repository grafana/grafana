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

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/util/optional"
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
					Repository: new("test-repo"),
					Pull: &provisioning.JobSyncJobOptions{
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
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
					Pull: &provisioning.JobSyncJobOptions{
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Branch:  new("main"),
						Message: new("Test commit"),
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Branch:  new("feature..branch"), // Invalid: contains consecutive dots
						Message: new("Test commit"),
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Path:    new("../../../etc/passwd"), // Invalid: path traversal
						Message: new("Test commit"),
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
					Delete:     &provisioning.JobDeleteJobOptions{},
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
					Repository: new("test-repo"),
					Delete: &provisioning.JobDeleteJobOptions{
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
					Repository: new("test-repo"),
					Delete: &provisioning.JobDeleteJobOptions{
						Resources: []provisioning.JobResourceRef{
							{
								Name: new("my-dashboard"),
								Kind: new("Dashboard"),
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
					Repository: new("test-repo"),
					Delete: &provisioning.JobDeleteJobOptions{
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
					Repository: new("test-repo"),
					Delete: &provisioning.JobDeleteJobOptions{
						Resources: []provisioning.JobResourceRef{
							{
								Kind: new("Dashboard"),
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						TargetPath: new("new-location/"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						Paths:      []string{"old-location/dashboard.json"},
						TargetPath: new("new-location/"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						Paths:      []string{"dashboard.json"},
						TargetPath: new("../../../etc/"), // Invalid: path traversal
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Message: new("Migrate from unified"),
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{
							{Name: new("dash-1"), Kind: new("Dashboard")},
							{Name: new("dash-2"), Kind: new("Dashboard"), Group: new("dashboard.grafana.app")},
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
					Repository: new("test-repo"),
					Migrate:    &provisioning.JobMigrateJobOptions{Branch: new("feature-x")},
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
					Repository: new("test-repo"),
					Migrate:    &provisioning.JobMigrateJobOptions{Branch: new("feature..branch")}, // Invalid: consecutive dots
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{{Kind: new("Dashboard")}},
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("dash-1")}},
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("folder-1"), Kind: new("Folder")}},
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("dash-1"), Kind: new("Dashboard"), Group: new("folder.grafana.app")}},
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
					Pr: &provisioning.JobPullRequestJobOptions{
						Pr:  new(int32(123)),
						Ref: new("refs/pull/123/head"),
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
					Repository: new("test-repo"),
					Delete: &provisioning.JobDeleteJobOptions{
						Resources: []provisioning.JobResourceRef{
							{
								Name: new("my-dashboard"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						Resources: []provisioning.JobResourceRef{
							{
								Name: new("my-dashboard"),
								Kind: new("Dashboard"),
							},
						},
						TargetPath: new("new-location/"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						Resources: []provisioning.JobResourceRef{
							{
								Name: new("my-dashboard"),
							},
						},
						TargetPath: new("new-location/"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						Paths: []string{"dashboard.json"},
						Resources: []provisioning.JobResourceRef{
							{
								Name: new("my-dashboard"),
								Kind: new("Dashboard"),
							},
						},
						TargetPath: new("new-location/"),
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
					Repository: new("test-repo"),
					Move: &provisioning.JobMoveJobOptions{
						Paths:      []string{"../invalid/path"},
						TargetPath: new("valid/target/"),
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
					Repository: new("test-repo"),
					Delete: &provisioning.JobDeleteJobOptions{
						Paths: []string{"dashboard.json"},
						Resources: []provisioning.JobResourceRef{
							{
								Name: new("my-dashboard"),
								Kind: new("Dashboard"),
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{
							{Name: new("dash-1"), Kind: new("Dashboard")},
							{Name: new("dash-2"), Kind: new("Dashboard"), Group: new("dashboard.grafana.app")},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Kind: new("Dashboard")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("dash-1")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("folder-1"), Kind: new("Folder")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("dash-1"), Kind: new("Dashboard"), Group: new("folder.grafana.app")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{
							{Name: new("pl-1"), Kind: new("Playlist")},
							{Name: new("pl-2"), Kind: new("Playlist"), Group: new("playlist.grafana.app")},
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("pl-1"), Kind: new("Playlist"), Group: new("playlist.grafana.app")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("dash-1"), Kind: new("Dashboard")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("pl-1"), Kind: new("Playlist")}},
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
			name: "push action with a member of a configured collection",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{
							{Name: new("ds-1"), Kind: new("DataSource"), Group: new("prometheus.datasource.grafana.app")},
						},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "*.datasource.grafana.app", Kind: "DataSource"},
			},
			wantErr: false,
		},
		{
			name: "push action omitting the group of a configured collection",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("ds-1"), Kind: new("DataSource")}},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "*.datasource.grafana.app", Kind: "DataSource"},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].group")
				require.Contains(t, err.Error(), "served by several groups")
			},
		},
		{
			// Filtering the disabled declaration first left the active collection covering it.
			name: "push action with a member declared on its own and disabled",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{
							{Name: new("ds-1"), Kind: new("DataSource"), Group: new("prometheus.datasource.grafana.app")},
						},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "prometheus.datasource.grafana.app", Kind: "DataSource", Disabled: true},
				{Group: "*.datasource.grafana.app", Kind: "DataSource"},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].group")
				require.Contains(t, err.Error(), "prometheus.datasource.grafana.app")
			},
		},
		{
			// Breaking on the concrete declaration accepted an empty group, which no client in
			// the operator can route and which picks an arbitrary member in-process.
			name: "push action omitting the group when a collection also declares the kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("ds-1"), Kind: new("DataSource")}},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "prometheus.datasource.grafana.app", Kind: "DataSource"},
				{Group: "*.datasource.grafana.app", Kind: "DataSource"},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].group")
				require.Contains(t, err.Error(), "served by several groups")
			},
		},
		{
			name: "push action naming the collection group itself",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionPush,
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Resources: []provisioning.JobResourceRef{
							{Name: new("ds-1"), Kind: new("DataSource"), Group: new("datasource.grafana.app")},
						},
					},
				},
			},
			supportedResources: []provisioning.SupportedResource{
				{Group: "*.datasource.grafana.app", Kind: "DataSource"},
			},
			wantErr: true,
			validateError: func(t *testing.T, err error) {
				require.Contains(t, err.Error(), "spec.push.resources[0].group")
			},
		},
		{
			name: "migrate action with wrong group for configured kind",
			job: &provisioning.Job{
				ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
				Spec: provisioning.JobSpec{
					Action:     provisioning.JobActionMigrate,
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
						Resources: []provisioning.JobResourceRef{{Name: new("pl-1"), Kind: new("Playlist"), Group: new("wrong.grafana.app")}},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
						Path:    new("some/valid/path"),
						Message: new("Test commit"),
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
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
					Repository:        new("test-repo"),
					FixFolderMetadata: &provisioning.JobFixFolderMetadataJobOptions{},
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
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
					Repository: new("test-repo"),
					Push: &provisioning.JobExportJobOptions{
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
					Repository: new("test-repo"),
					Migrate: &provisioning.JobMigrateJobOptions{
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
					Repository: new("test-repo"),
					Test:       &provisioning.JobTestJobOptions{Duration: metav1.Duration{Duration: 10 * time.Second}},
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
					Test:       &provisioning.JobTestJobOptions{Duration: metav1.Duration{Duration: 0}},
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
					Repository: new("test-repo"),
					Test:       &provisioning.JobTestJobOptions{Duration: metav1.Duration{Duration: MaxTestJobDuration + time.Second}},
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
					Repository: new("test-repo"),
					Test: &provisioning.JobTestJobOptions{
						Duration:        metav1.Duration{Duration: 10 * time.Second},
						ProgressUpdates: new(int32(-1)),
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
					Repository: new("test-repo"),
					Test: &provisioning.JobTestJobOptions{
						// 1s / 100 updates = 10ms apart, far below the throttle.
						Duration:        metav1.Duration{Duration: time.Second},
						ProgressUpdates: new(int32(100)),
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
					Repository: new("test-repo"),
					Test: &provisioning.JobTestJobOptions{
						// 10s / 20 updates = 500ms apart, exactly deliverable.
						Duration:        metav1.Duration{Duration: 10 * time.Second},
						ProgressUpdates: new(int32(20)),
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
					Repository: new("test-repo"),
					Test: &provisioning.JobTestJobOptions{
						Duration:        metav1.Duration{Duration: 10 * time.Second},
						ProgressUpdates: new(int32(MaxTestJobProgressUpdates + 1)),
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
					Repository: new("test-repo"),
					Pull:       &provisioning.JobSyncJobOptions{Incremental: true},
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
					Repository: new("test-repo"),
					Test:       &provisioning.JobTestJobOptions{Duration: metav1.Duration{Duration: 10 * time.Second}},
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
					Repository: new("test-repo"),
					Test:       &provisioning.JobTestJobOptions{Duration: metav1.Duration{Duration: 10 * time.Second}},
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
					Repository: new("test-repo"),
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
					Repository: new("test-repo"),
				},
			},
			operation:   admission.Update,
			perfEnabled: true,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := NewAdmissionValidator(func() []provisioning.SupportedResource { return nil }, func(context.Context) bool { return tt.perfEnabled })

			var obj runtime.Object
			if tt.obj != nil {
				obj = tt.obj.(runtime.Object)
			}

			attr := newAdmissionTestAttributes(obj, tt.operation)

			err := v.Validate(t.Context(), attr, nil)

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

// The supported resources can change while the process runs, so the validator reads them on
// each validation.
func TestAdmissionValidator_ReadsTheSupportedResourcesOnEachValidation(t *testing.T) {
	dashboard := provisioning.SupportedResource{Group: "dashboard.grafana.app", Kind: "Dashboard"}
	widget := provisioning.SupportedResource{Group: "example.ext.grafana.app", Kind: "Widget"}
	supported := []provisioning.SupportedResource{dashboard}
	v := NewAdmissionValidator(func() []provisioning.SupportedResource { return supported }, nil)
	job := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job"},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionPush,
			Repository: new("test-repo"),
			Push: &provisioning.JobExportJobOptions{
				Resources: []provisioning.JobResourceRef{{Name: new("widget-1"), Kind: new("Widget"), Group: new("example.ext.grafana.app")}},
			},
		},
	}

	err := v.Validate(t.Context(), newAdmissionTestAttributes(job, admission.Create), nil)
	require.ErrorContains(t, err, "kind is not supported for export")

	supported = []provisioning.SupportedResource{dashboard, widget}
	require.NoError(t, v.Validate(t.Context(), newAdmissionTestAttributes(job, admission.Create), nil))
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
				Spec: provisioning.HistoricJobSpec{
					Action:     provisioning.HistoricJobActionPull,
					Repository: new("test-repo"),
				},
			},
			operation: admission.Create,
			wantErr:   false,
		},
		{
			name: "historic job missing action fails validation",
			obj: &provisioning.HistoricJob{
				ObjectMeta: metav1.ObjectMeta{Name: "test-historic-job"},
				Spec: provisioning.HistoricJobSpec{
					Repository: new("test-repo"),
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
				Spec: provisioning.HistoricJobSpec{
					Action: provisioning.HistoricJobActionPull,
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
				Spec: provisioning.HistoricJobSpec{
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
func makeDashboardRefs(n int) []provisioning.JobResourceRef {
	refs := make([]provisioning.JobResourceRef, n)
	for i := range refs {
		refs[i] = provisioning.JobResourceRef{Name: optional.NonZero(fmt.Sprintf("dash-%d", i)), Kind: new("Dashboard")}
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

func withProvisioningServiceIdentity(r identity.StaticRequester) *identity.StaticRequester {
	r.AccessTokenClaims = &authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{ServiceIdentity: "provisioning.grafana.app"}}
	return &r
}

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
	serviceIdentityCtx := identity.WithRequester(t.Context(), withProvisioningServiceIdentity(identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "42"}))

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
			name:        "create by the provisioning service identity",
			ctx:         serviceIdentityCtx,
			operation:   admission.Create,
			annotations: map[string]string{AnnoAuthor: "grot", AnnoAuthorID: "123", AnnoAuthorOrigin: "github"},
		},
		{
			name:        "create by a user whose token carries the provisioning service identity",
			ctx:         identity.WithRequester(t.Context(), withProvisioningServiceIdentity(*requester)),
			operation:   admission.Create,
			annotations: annotations,
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
			wantErrContains: AnnoAuthorOrigin + " may not be set",
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

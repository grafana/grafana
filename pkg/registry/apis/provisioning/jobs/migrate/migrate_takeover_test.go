package migrate

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// fakeMigrationExporter records how the migration called it. When the
// migration asks for the folder UID check, it returns results that keep
// "kept-folder" and skip the folders in skipped.
type fakeMigrationExporter struct {
	skipped []string

	called               bool
	folderCheck          *resources.FolderCheckOptions
	generateNewFolderIDs bool
}

func (f *fakeMigrationExporter) ExportForMigration(_ context.Context, _ repository.Repository, job provisioning.Job, _ jobs.JobProgressRecorder, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error) {
	f.called = true
	f.folderCheck = folderCheck
	f.generateNewFolderIDs = job.Spec.Push.GenerateNewFolderIDs
	if folderCheck == nil {
		return nil, nil
	}
	return &resources.FolderCheckResults{Kept: []string{"kept-folder"}, Skipped: f.skipped}, nil
}

func TestMigrationWorker_FolderTakeover(t *testing.T) {
	newRepoConfig := func(target provisioning.SyncTargetType) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Namespace: "test-ns"},
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git:  &provisioning.GitRepositoryConfig{Branch: "main"},
				Sync: provisioning.SyncOptions{Target: target},
			},
		}
	}

	newProgress := func(t *testing.T) *jobs.MockJobProgressRecorder {
		pr := jobs.NewMockJobProgressRecorder(t)
		pr.On("SetMessage", mock.Anything, mock.Anything).Return()
		pr.On("StrictMaxErrors", 1).Return()
		return pr
	}

	newMigrator := func(nc NamespaceCleaner, syncWorker jobs.Worker, exporter *fakeMigrationExporter, enabled bool) *MigrationWorker {
		m := NewMigrationWorker(nc, exporter, syncWorker)
		m.takeoverEnabled = func(context.Context, string) bool { return enabled }
		return m
	}

	for _, generateNewIDs := range []bool{true, false} {
		t.Run(fmt.Sprintf("the export runs the check with generateNewFolderIDs=%t", generateNewIDs), func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repo.On("Config").Return(newRepoConfig(provisioning.SyncTargetTypeFolder))
			exporter := &fakeMigrationExporter{}

			m := newMigrator(NewMockNamespaceCleaner(t), jobs.NewMockWorker(t), exporter, true)
			err := m.migrate(context.Background(), repo, provisioning.Job{Spec: provisioning.JobSpec{
				Migrate: &provisioning.MigrateJobOptions{Branch: "feature-x", GenerateNewFolderIDs: generateNewIDs, SkipResourceDeletion: true},
			}}, newProgress(t))

			require.NoError(t, err)
			require.True(t, exporter.called)
			require.Equal(t, &resources.FolderCheckOptions{GenerateNewIDs: generateNewIDs}, exporter.folderCheck, "generateNewFolderIDs decides what happens to folders that cannot keep their UID")
			require.False(t, exporter.generateNewFolderIDs, "the folder UID check decides the UID of each folder")
		})
	}

	t.Run("direct write runs the check and pulls the resources", func(t *testing.T) {
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(newRepoConfig(provisioning.SyncTargetTypeFolder))
		exporter := &fakeMigrationExporter{}
		syncWorker := jobs.NewMockWorker(t)
		syncWorker.On("Process", mock.Anything, repo, mock.Anything, mock.Anything).Return(nil)
		pr := newProgress(t)
		pr.On("ResetResults", false).Return()

		m := newMigrator(NewMockNamespaceCleaner(t), syncWorker, exporter, true)
		err := m.migrate(context.Background(), repo, provisioning.Job{Spec: provisioning.JobSpec{
			Migrate: &provisioning.MigrateJobOptions{GenerateNewFolderIDs: true},
		}}, pr)

		require.NoError(t, err)
		require.True(t, exporter.called)
	})

	t.Run("direct write keeps the warnings about folders that are not migrated", func(t *testing.T) {
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(newRepoConfig(provisioning.SyncTargetTypeFolder))
		exporter := &fakeMigrationExporter{skipped: []string{"mixed-folder"}}
		syncWorker := jobs.NewMockWorker(t)
		syncWorker.On("Process", mock.Anything, repo, mock.Anything, mock.Anything).Return(nil)
		pr := newProgress(t)
		pr.On("ResetResults", true).Return()

		m := newMigrator(NewMockNamespaceCleaner(t), syncWorker, exporter, true)
		err := m.migrate(context.Background(), repo, provisioning.Job{Spec: provisioning.JobSpec{
			Migrate: &provisioning.MigrateJobOptions{},
		}}, pr)

		require.NoError(t, err)
	})

	t.Run("the export does not run the check when the feature flag is off", func(t *testing.T) {
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(newRepoConfig(provisioning.SyncTargetTypeFolder))
		exporter := &fakeMigrationExporter{}

		m := newMigrator(NewMockNamespaceCleaner(t), jobs.NewMockWorker(t), exporter, false)
		err := m.migrate(context.Background(), repo, provisioning.Job{Spec: provisioning.JobSpec{
			Migrate: &provisioning.MigrateJobOptions{Branch: "feature-x", GenerateNewFolderIDs: true, SkipResourceDeletion: true},
		}}, newProgress(t))

		require.NoError(t, err)
		require.True(t, exporter.called)
		require.Nil(t, exporter.folderCheck)
		require.True(t, exporter.generateNewFolderIDs, "without the check, generateNewFolderIDs gives every folder a new UID")
	})

	t.Run("an instance repository also runs the check", func(t *testing.T) {
		repo := repository.NewMockRepository(t)
		repo.On("Config").Return(newRepoConfig(provisioning.SyncTargetTypeInstance))
		exporter := &fakeMigrationExporter{}
		nc := NewMockNamespaceCleaner(t)
		nc.On("Clean", mock.Anything, "test-ns", mock.Anything).Return(nil)
		syncWorker := jobs.NewMockWorker(t)
		syncWorker.On("Process", mock.Anything, repo, mock.Anything, mock.Anything).Return(nil)
		pr := newProgress(t)
		pr.On("ResetResults", false).Return()

		m := newMigrator(nc, syncWorker, exporter, true)
		err := m.migrate(context.Background(), repo, provisioning.Job{Spec: provisioning.JobSpec{
			Migrate: &provisioning.MigrateJobOptions{},
		}}, pr)

		require.NoError(t, err)
		require.True(t, exporter.called)
	})
}

package fixfoldermetadata

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

var testFolderGVK = resources.FolderKind

func TestWorker_IsSupported(t *testing.T) {
	w := NewWorker(testFolderGVK)

	tests := []struct {
		name     string
		action   provisioning.JobAction
		expected bool
	}{
		{name: "fix-folder-metadata action", action: provisioning.JobActionFixFolderMetadata, expected: true},
		{name: "pull action", action: provisioning.JobActionPull, expected: false},
		{name: "push action", action: provisioning.JobActionPush, expected: false},
		{name: "delete action", action: provisioning.JobActionDelete, expected: false},
		{name: "move action", action: provisioning.JobActionMove, expected: false},
		{name: "migrate action", action: provisioning.JobActionMigrate, expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := provisioning.Job{Spec: provisioning.JobSpec{Action: tt.action}}
			require.Equal(t, tt.expected, w.IsSupported(context.Background(), job))
		})
	}
}

// mockStageableRepo implements repository.Repository and repository.StageableRepository
type mockStageableRepo struct {
	*repository.MockStageableRepository
}

func (m *mockStageableRepo) Config() *provisioning.Repository {
	return &provisioning.Repository{}
}

func (m *mockStageableRepo) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return &provisioning.TestResults{}, nil
}

// mockStageableRepoWithURLs combines StageableRepository and RepositoryWithURLs
type mockStageableRepoWithURLs struct {
	mockStageableRepo
	*repository.MockRepositoryWithURLs
}

func (m *mockStageableRepoWithURLs) Config() *provisioning.Repository {
	return &provisioning.Repository{}
}

func (m *mockStageableRepoWithURLs) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return &provisioning.TestResults{}, nil
}

// mockNonRWRepo implements only repository.Repository (no staging, no read/write)
type mockNonRWRepo struct{}

func (m *mockNonRWRepo) Config() *provisioning.Repository { return &provisioning.Repository{} }
func (m *mockNonRWRepo) Test(_ context.Context) (*provisioning.TestResults, error) {
	return &provisioning.TestResults{}, nil
}

func makeTestJob(ref string) provisioning.Job {
	return provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "default",
		},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionFixFolderMetadata,
			Repository: "test-repo",
			FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
				Ref: ref,
			},
		},
	}
}

func treeEntry(path string, blob bool) repository.FileTreeEntry {
	return repository.FileTreeEntry{Path: path, Blob: blob}
}

func repoConfig(name string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: name},
	}
}

func TestWorker_Process(t *testing.T) {
	t.Run("creates _folder.json for directories without metadata", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("feature-branch")

		tree := []repository.FileTreeEntry{
			treeEntry("parent", false),
			treeEntry("parent/child", false),
		}

		parentFolder := resources.ParseFolder("parent/", "test-repo")
		childFolder := resources.ParseFolder("parent/child/", "test-repo")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == "feature-branch" && opts.Mode == repository.StageModeCommitOnlyOnce
		})).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "feature-branch").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		mockStaged.EXPECT().Create(mock.Anything, "parent/_folder.json", "feature-branch", mock.Anything, mock.Anything).Return(nil)
		mockStaged.EXPECT().Create(mock.Anything, "parent/child/_folder.json", "feature-branch", mock.Anything, mock.Anything).Return(nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on branch feature-branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 2).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == parentFolder.ID
		})).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == childFolder.ID
		})).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on branch feature-branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("skips directories that already have _folder.json", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		tree := []repository.FileTreeEntry{
			treeEntry("myfolder", false),
			treeEntry("myfolder/_folder.json", true),
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		// No Create expected — the file already exists

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 0).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("mixed: creates missing metadata and skips existing", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		tree := []repository.FileTreeEntry{
			treeEntry("has-meta", false),
			treeEntry("has-meta/_folder.json", true),
			treeEntry("no-meta", false),
		}

		noMetaFolder := resources.ParseFolder("no-meta/", "test-repo")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		mockStaged.EXPECT().Create(mock.Anything, "no-meta/_folder.json", "", mock.Anything, mock.Anything).Return(nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 1).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == noMetaFolder.ID
		})).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("fails immediately when Create returns an error", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")
		createErr := fmt.Errorf("disk full")

		tree := []repository.FileTreeEntry{
			treeEntry("myfolder", false),
			treeEntry("other", false),
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		// Only the first folder is attempted; second is never reached.
		mockStaged.EXPECT().Create(mock.Anything, "myfolder/_folder.json", "", mock.Anything, mock.Anything).Return(createErr)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 2).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Error() != nil
		})).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, mock.MatchedBy(func(s string) bool { return s != "" })).Return()

		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.ErrorContains(t, err, "disk full")
		require.ErrorContains(t, err, "myfolder")
	})

	t.Run("uses default branch when options are nil", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
			Spec: provisioning.JobSpec{
				Action:            provisioning.JobActionFixFolderMetadata,
				Repository:        "test-repo",
				FixFolderMetadata: nil,
			},
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == ""
		})).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return([]repository.FileTreeEntry{}, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 0).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("returns error when ReadTree fails", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(nil, fmt.Errorf("git error"))

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, mock.MatchedBy(func(s string) bool { return s != "" })).Return()

		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.ErrorContains(t, err, "read repository tree")
	})

	t.Run("returns error when repository does not support read/write operations", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		// mockNonRWRepo is not stageable, so WrapWithStageAndPushIfPossible calls fn with the original repo.
		// The original repo does not implement ReaderWriter, so the cast fails.
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, mock.MatchedBy(func(s string) bool { return s != "" })).Return()

		err := w.Process(ctx, &mockNonRWRepo{}, job, mockProgress)
		require.ErrorContains(t, err, "does not support read/write operations")
	})

	t.Run("sets ref URLs when repository supports it and ref is specified", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepoWithURLs{
			mockStageableRepo:      mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)},
			MockRepositoryWithURLs: repository.NewMockRepositoryWithURLs(t),
		}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		customRef := "feature-branch"
		job := makeTestJob(customRef)

		expectedURLs := &provisioning.RepositoryURLs{
			RepositoryURL:     "https://github.com/test/repo",
			SourceURL:         "https://github.com/test/repo/tree/feature-branch",
			NewPullRequestURL: "https://github.com/test/repo/compare/feature-branch",
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, customRef).Return([]repository.FileTreeEntry{}, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, fmt.Sprintf("Writing folder metadata files on branch %s", customRef)).Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 0).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, fmt.Sprintf("Folder metadata fixed on branch %s", customRef)).Return()

		mockRepo.MockRepositoryWithURLs.EXPECT().RefURLs(mock.Anything, customRef).Return(expectedURLs, nil)
		mockProgress.EXPECT().SetRefURLs(mock.Anything, expectedURLs).Return()

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("blob entries are not processed as directories", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		// Only blob entries, no directory entries
		tree := []repository.FileTreeEntry{
			treeEntry("dashboard.json", true),
			treeEntry("other.json", true),
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 0).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("deletes .keep file after creating _folder.json", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		tree := []repository.FileTreeEntry{
			treeEntry("myfolder", false),
			treeEntry("myfolder/.keep", true),
		}

		myFolder := resources.ParseFolder("myfolder/", "test-repo")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		mockStaged.EXPECT().Create(mock.Anything, "myfolder/_folder.json", "", mock.Anything, mock.Anything).Return(nil)
		mockStaged.EXPECT().Delete(mock.Anything, "myfolder/.keep", "", mock.Anything).Return(nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 1).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == myFolder.ID
		})).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("deletes .keep file from folder that already has _folder.json", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		tree := []repository.FileTreeEntry{
			treeEntry("myfolder", false),
			treeEntry("myfolder/_folder.json", true),
			treeEntry("myfolder/.keep", true),
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		// No Create expected — _folder.json already exists
		mockStaged.EXPECT().Delete(mock.Anything, "myfolder/.keep", "", mock.Anything).Return(nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 0).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("tolerates .keep file already absent when deleting", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		tree := []repository.FileTreeEntry{
			treeEntry("myfolder", false),
			treeEntry("myfolder/.keep", true),
		}

		myFolder := resources.ParseFolder("myfolder/", "test-repo")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		mockStaged.EXPECT().Create(mock.Anything, "myfolder/_folder.json", "", mock.Anything, mock.Anything).Return(nil)
		mockStaged.EXPECT().Delete(mock.Anything, "myfolder/.keep", "", mock.Anything).Return(repository.ErrFileNotFound)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 1).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == myFolder.ID
		})).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("does not attempt .keep deletion when folder has no .keep", func(t *testing.T) {
		ctx := context.Background()
		w := NewWorker(testFolderGVK)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		tree := []repository.FileTreeEntry{
			treeEntry("myfolder", false),
			treeEntry("myfolder/dashboard.json", true),
		}

		myFolder := resources.ParseFolder("myfolder/", "test-repo")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)

		mockStaged.EXPECT().ReadTree(mock.Anything, "").Return(tree, nil)
		mockStaged.EXPECT().Config().Return(repoConfig("test-repo"))
		mockStaged.EXPECT().Create(mock.Anything, "myfolder/_folder.json", "", mock.Anything, mock.Anything).Return(nil)
		// No Delete expected — there is no .keep file

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetTotal(mock.Anything, 1).Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == myFolder.ID
		})).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})
}

package fixfoldermetadata

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestWorker_IsSupported(t *testing.T) {
	w := NewWorker(nil)

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

func makeFolderItem(name, path, title string) provisioning.ResourceListItem {
	return provisioning.ResourceListItem{
		Group: folders.GROUP,
		Name:  name,
		Path:  path,
		Title: title,
	}
}

func TestWorker_Process(t *testing.T) {
	t.Run("calls EnsureFolderMetadata for each folder", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("feature-branch")

		list := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				makeFolderItem("uid-parent", "parent/", "parent"),
				makeFolderItem("uid-child", "parent/child/", "child"),
			},
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == "feature-branch" && opts.Mode == repository.StageModeCommitOnlyOnce
		})).Return(mockStaged, nil)

		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(list, nil)
		mockRepoResources.EXPECT().EnsureFolderMetadata(mock.Anything, resources.Folder{ID: "uid-parent", Path: "parent/", Title: "parent"}, "feature-branch").Return(true, nil)
		mockRepoResources.EXPECT().EnsureFolderMetadata(mock.Anything, resources.Folder{ID: "uid-child", Path: "parent/child/", Title: "child"}, "feature-branch").Return(false, nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on branch feature-branch").Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionCreated && r.Name() == "uid-parent"
		})).Return()
		mockProgress.EXPECT().TooManyErrors().Return(nil).Once()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Action() == repository.FileActionIgnored && r.Name() == "uid-child"
		})).Return()
		mockProgress.EXPECT().TooManyErrors().Return(nil).Once()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on branch feature-branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("skips non-folder resources", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		list := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{Group: "dashboard.grafana.app", Name: "dash-uid", Path: "dash.json", Title: "My Dashboard"},
				makeFolderItem("uid-folder", "myfolder/", "myfolder"),
			},
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(list, nil)
		// Only the folder item should trigger EnsureFolderMetadata, not the dashboard
		mockRepoResources.EXPECT().EnsureFolderMetadata(mock.Anything, resources.Folder{ID: "uid-folder", Path: "myfolder/", Title: "myfolder"}, "").Return(true, nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.Anything).Return()
		mockProgress.EXPECT().TooManyErrors().Return(nil)
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("records error when EnsureFolderMetadata fails but continues", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")
		folderErr := fmt.Errorf("disk full")

		list := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				makeFolderItem("uid-folder", "myfolder/", "myfolder"),
			},
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(list, nil)
		mockRepoResources.EXPECT().EnsureFolderMetadata(mock.Anything, resources.Folder{ID: "uid-folder", Path: "myfolder/", Title: "myfolder"}, "").Return(false, folderErr)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.MatchedBy(func(r jobs.JobResourceResult) bool {
			return r.Error() != nil
		})).Return()
		mockProgress.EXPECT().TooManyErrors().Return(nil)
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("stops early when too many errors", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")
		tooManyErr := fmt.Errorf("too many errors")

		list := &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				makeFolderItem("uid-first", "first/", "first"),
				makeFolderItem("uid-second", "second/", "second"),
			},
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(list, nil)
		// Only first folder is processed; TooManyErrors stops iteration before second
		mockRepoResources.EXPECT().EnsureFolderMetadata(mock.Anything, resources.Folder{ID: "uid-first", Path: "first/", Title: "first"}, "").Return(true, nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().Record(mock.Anything, mock.Anything).Return()
		mockProgress.EXPECT().TooManyErrors().Return(tooManyErr)
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, mock.MatchedBy(func(s string) bool { return s != "" })).Return()

		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.ErrorIs(t, err, tooManyErr)
	})

	t.Run("uses default branch when options are nil", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "default"},
			Spec: provisioning.JobSpec{
				Action:            provisioning.JobActionFixFolderMetadata,
				Repository:        "test-repo",
				FixFolderMetadata: nil,
			},
		}
		emptyList := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == ""
		})).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(emptyList, nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, "Folder metadata fixed on default branch").Return()

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("returns error when repository resources client creation fails", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")
		factoryErr := fmt.Errorf("failed to create client")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(nil, factoryErr)

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, mock.MatchedBy(func(s string) bool { return s != "" })).Return()

		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.ErrorContains(t, err, "create repository resources client")
	})

	t.Run("returns error when listing managed resources fails", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := makeTestJob("")

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(nil, fmt.Errorf("storage unavailable"))

		mockProgress.EXPECT().SetMessage(mock.Anything, "Writing folder metadata files on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, mock.MatchedBy(func(s string) bool { return s != "" })).Return()

		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.ErrorContains(t, err, "list managed resources")
	})

	t.Run("sets ref URLs when repository supports it and ref is specified", func(t *testing.T) {
		ctx := context.Background()
		mockFactory := resources.NewMockRepositoryResourcesFactory(t)
		w := NewWorker(mockFactory)

		mockRepo := &mockStageableRepoWithURLs{
			mockStageableRepo:      mockStageableRepo{MockStageableRepository: repository.NewMockStageableRepository(t)},
			MockRepositoryWithURLs: repository.NewMockRepositoryWithURLs(t),
		}
		mockStaged := repository.NewMockStagedRepository(t)
		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		customRef := "feature-branch"
		job := makeTestJob(customRef)
		emptyList := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}

		expectedURLs := &provisioning.RepositoryURLs{
			RepositoryURL:     "https://github.com/test/repo",
			SourceURL:         "https://github.com/test/repo/tree/feature-branch",
			NewPullRequestURL: "https://github.com/test/repo/compare/feature-branch",
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(mock.Anything, mock.Anything).Return(mockStaged, nil)
		mockFactory.On("Client", mock.Anything, mockStaged).Return(mockRepoResources, nil)
		mockRepoResources.EXPECT().List(mock.Anything).Return(emptyList, nil)

		mockStaged.EXPECT().Push(mock.Anything).Return(nil)
		mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

		mockProgress.EXPECT().SetMessage(mock.Anything, fmt.Sprintf("Writing folder metadata files on branch %s", customRef)).Return()
		mockProgress.EXPECT().SetFinalMessage(mock.Anything, fmt.Sprintf("Folder metadata fixed on branch %s", customRef)).Return()

		mockRepo.MockRepositoryWithURLs.EXPECT().RefURLs(mock.Anything, customRef).Return(expectedURLs, nil)
		mockProgress.EXPECT().SetRefURLs(mock.Anything, expectedURLs).Return()

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})
}

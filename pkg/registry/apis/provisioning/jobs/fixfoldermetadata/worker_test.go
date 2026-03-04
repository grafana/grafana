package fixfoldermetadata

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func TestWorker_IsSupported(t *testing.T) {
	w := NewWorker()

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

func TestWorker_Process(t *testing.T) {
	t.Run("creates marker commit with empty ref (uses repository default)", func(t *testing.T) {
		w := NewWorker()
		ctx := context.Background()

		mockRepo := &mockStageableRepo{
			MockStageableRepository: repository.NewMockStageableRepository(t),
		}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:            provisioning.JobActionFixFolderMetadata,
				Repository:        "test-repo",
				FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{},
			},
		}

		// Expect staging to be called with empty ref (repository determines default)
		mockRepo.MockStageableRepository.EXPECT().Stage(ctx, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == "" &&
				opts.Mode == repository.StageModeCommitOnlyOnce &&
				strings.Contains(opts.CommitOnlyOnceMessage, "Fix folder metadata")
		})).Return(mockStaged, nil)

		// Expect a marker file to be written with empty ref
		mockStaged.EXPECT().Write(ctx, mock.MatchedBy(func(path string) bool {
			return strings.HasPrefix(path, ".grafana/folder-metadata-fixed-")
		}), "", mock.Anything, mock.Anything).Return(nil)

		// Expect push to be called
		mockStaged.EXPECT().Push(ctx).Return(nil)

		// Expect cleanup
		mockStaged.EXPECT().Remove(ctx).Return(nil)

		// Expect progress updates with "default branch" message
		mockProgress.EXPECT().SetMessage(ctx, "Creating marker commit on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(ctx, "Folder metadata fixed on default branch").Return()

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("creates marker commit with custom ref", func(t *testing.T) {
		w := NewWorker()
		ctx := context.Background()

		mockRepo := &mockStageableRepo{
			MockStageableRepository: repository.NewMockStageableRepository(t),
		}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		customRef := "feature-branch"
		job := provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionFixFolderMetadata,
				Repository: "test-repo",
				FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
					Ref: customRef,
				},
			},
		}

		// Expect staging to be called with custom ref
		mockRepo.MockStageableRepository.EXPECT().Stage(ctx, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == customRef
		})).Return(mockStaged, nil)

		// Expect a marker file to be written
		mockStaged.EXPECT().Write(ctx, mock.Anything, customRef, mock.Anything, mock.Anything).Return(nil)

		// Expect push to be called
		mockStaged.EXPECT().Push(ctx).Return(nil)

		// Expect cleanup
		mockStaged.EXPECT().Remove(ctx).Return(nil)

		// Expect progress updates
		mockProgress.EXPECT().SetMessage(ctx, fmt.Sprintf("Creating marker commit on branch %s", customRef)).Return()
		mockProgress.EXPECT().SetFinalMessage(ctx, fmt.Sprintf("Folder metadata fixed on branch %s", customRef)).Return()

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("sets ref URLs when repository supports it and ref is specified", func(t *testing.T) {
		w := NewWorker()
		ctx := context.Background()

		// Create a mock that implements both interfaces
		mockRepo := &mockStageableRepoWithURLs{
			mockStageableRepo: mockStageableRepo{
				MockStageableRepository: repository.NewMockStageableRepository(t),
			},
			MockRepositoryWithURLs: repository.NewMockRepositoryWithURLs(t),
		}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		customRef := "feature-branch"
		job := provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionFixFolderMetadata,
				Repository: "test-repo",
				FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
					Ref: customRef,
				},
			},
		}

		expectedURLs := &provisioning.RepositoryURLs{
			RepositoryURL:     "https://github.com/test/repo",
			SourceURL:         "https://github.com/test/repo/tree/feature-branch",
			NewPullRequestURL: "https://github.com/test/repo/compare/feature-branch",
		}

		mockRepo.MockStageableRepository.EXPECT().Stage(ctx, mock.Anything).Return(mockStaged, nil)
		mockStaged.EXPECT().Write(ctx, mock.Anything, customRef, mock.Anything, mock.Anything).Return(nil)
		mockStaged.EXPECT().Push(ctx).Return(nil)
		mockStaged.EXPECT().Remove(ctx).Return(nil)
		mockProgress.EXPECT().SetMessage(ctx, fmt.Sprintf("Creating marker commit on branch %s", customRef)).Return()
		mockProgress.EXPECT().SetFinalMessage(ctx, fmt.Sprintf("Folder metadata fixed on branch %s", customRef)).Return()

		// Expect RefURLs to be called with the custom ref and SetRefURLs to be called with the result
		mockRepo.MockRepositoryWithURLs.EXPECT().RefURLs(ctx, customRef).Return(expectedURLs, nil)
		mockProgress.EXPECT().SetRefURLs(ctx, expectedURLs).Return()

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})

	t.Run("uses repository default when options are nil", func(t *testing.T) {
		w := NewWorker()
		ctx := context.Background()

		mockRepo := &mockStageableRepo{
			MockStageableRepository: repository.NewMockStageableRepository(t),
		}
		mockStaged := repository.NewMockStagedRepository(t)
		mockProgress := jobs.NewMockJobProgressRecorder(t)

		job := provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-job",
				Namespace: "default",
			},
			Spec: provisioning.JobSpec{
				Action:            provisioning.JobActionFixFolderMetadata,
				Repository:        "test-repo",
				FixFolderMetadata: nil, // Nil options should use repository default
			},
		}

		// Expect staging with empty ref (repository determines default)
		mockRepo.MockStageableRepository.EXPECT().Stage(ctx, mock.MatchedBy(func(opts repository.StageOptions) bool {
			return opts.Ref == ""
		})).Return(mockStaged, nil)

		mockStaged.EXPECT().Write(ctx, mock.Anything, "", mock.Anything, mock.Anything).Return(nil)
		mockStaged.EXPECT().Push(ctx).Return(nil)
		mockStaged.EXPECT().Remove(ctx).Return(nil)
		mockProgress.EXPECT().SetMessage(ctx, "Creating marker commit on default branch").Return()
		mockProgress.EXPECT().SetFinalMessage(ctx, "Folder metadata fixed on default branch").Return()

		err := w.Process(ctx, mockRepo, job, mockProgress)
		require.NoError(t, err)
	})
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

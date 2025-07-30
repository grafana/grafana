package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockStagedRepo struct {
	*MockStageableRepository
	*MockStagedRepository
}

func Test_WrapWithStageAndPushIfPossible_NonStageableRepository(t *testing.T) {
	nonStageable := NewMockRepository(t)
	var called bool
	fn := func(repo Repository, staged bool) error {
		called = true
		return errors.New("operation failed")
	}

	err := WrapWithStageAndPushIfPossible(context.Background(), nonStageable, StageOptions{}, fn)
	require.EqualError(t, err, "operation failed")
	require.True(t, called)
}

func TestWrapWithStageAndPushIfPossible(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(t *testing.T) *mockStagedRepo
		operation     func(repo Repository, staged bool) error
		expectedError string
	}{
		{
			name: "successful stage, operation, and push",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(nil)
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)
				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				require.True(t, staged)
				return nil
			},
		},
		{
			name: "stage failure",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(nil, errors.New("stage failed"))

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
			expectedError: "stage repository: stage failed",
		},
		{
			name: "operation failure",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return errors.New("operation failed")
			},
			expectedError: "operation failed",
		},
		{
			name: "push failure",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(errors.New("push failed"))
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
			expectedError: "wrapped push error: push failed",
		},
		{
			name: "remove failure should only log",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(nil)
				mockStaged.EXPECT().Remove(mock.Anything).Return(errors.New("remove failed"))

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
		},
		{
			name: "nothing to push - should not error",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(ErrNothingToPush)
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
		},
		{
			name: "nothing to commit - should not error",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(ErrNothingToCommit)
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
		},
		{
			name: "wrapped nothing to push error - should not error",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				wrappedErr := fmt.Errorf("some wrapper: %w", ErrNothingToPush)
				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(wrappedErr)
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
		},
		{
			name: "wrapped nothing to commit error - should not error",
			setupMocks: func(t *testing.T) *mockStagedRepo {
				mockRepo := NewMockStageableRepository(t)
				mockStaged := NewMockStagedRepository(t)

				wrappedErr := fmt.Errorf("some wrapper: %w", ErrNothingToCommit)
				mockRepo.EXPECT().Stage(mock.Anything, StageOptions{}).Return(mockStaged, nil)
				mockStaged.EXPECT().Push(mock.Anything).Return(wrappedErr)
				mockStaged.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockStagedRepo{
					MockStageableRepository: mockRepo,
					MockStagedRepository:    mockStaged,
				}
			},
			operation: func(repo Repository, staged bool) error {
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := tt.setupMocks(t)
			err := WrapWithStageAndPushIfPossible(context.Background(), repo, StageOptions{}, tt.operation)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

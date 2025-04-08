package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockClonableRepo struct {
	*MockClonableRepository
	*MockClonedRepository
}

func Test_WrapWithCloneAndPushIfPossible_NonClonableRepository(t *testing.T) {
	nonClonable := NewMockRepository(t)
	var called bool
	fn := func(repo Repository, cloned bool) error {
		called = true
		return errors.New("operation failed")
	}

	err := WrapWithCloneAndPushIfPossible(context.Background(), nonClonable, CloneOptions{}, PushOptions{}, fn)
	require.EqualError(t, err, "operation failed")
	require.True(t, called)
}

func TestWrapWithCloneAndPushIfPossible(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(t *testing.T) *mockClonableRepo
		operation     func(repo Repository, cloned bool) error
		expectedError string
	}{
		{
			name: "successful clone, operation, and push",
			setupMocks: func(t *testing.T) *mockClonableRepo {
				mockRepo := NewMockClonableRepository(t)
				mockCloned := NewMockClonedRepository(t)

				mockRepo.EXPECT().Clone(mock.Anything, CloneOptions{}).Return(mockCloned, nil)
				mockCloned.EXPECT().Push(mock.Anything, PushOptions{}).Return(nil)
				mockCloned.EXPECT().Remove(mock.Anything).Return(nil)
				return &mockClonableRepo{
					MockClonableRepository: mockRepo,
					MockClonedRepository:   mockCloned,
				}
			},
			operation: func(repo Repository, cloned bool) error {
				require.True(t, cloned)
				return nil
			},
		},
		{
			name: "clone failure",
			setupMocks: func(t *testing.T) *mockClonableRepo {
				mockRepo := NewMockClonableRepository(t)

				mockRepo.EXPECT().Clone(mock.Anything, CloneOptions{}).Return(nil, errors.New("clone failed"))

				return &mockClonableRepo{
					MockClonableRepository: mockRepo,
				}
			},
			operation: func(repo Repository, cloned bool) error {
				return nil
			},
			expectedError: "clone repository: clone failed",
		},
		{
			name: "operation failure",
			setupMocks: func(t *testing.T) *mockClonableRepo {
				mockRepo := NewMockClonableRepository(t)
				mockCloned := NewMockClonedRepository(t)

				mockRepo.EXPECT().Clone(mock.Anything, CloneOptions{}).Return(mockCloned, nil)
				mockCloned.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockClonableRepo{
					MockClonableRepository: mockRepo,
					MockClonedRepository:   mockCloned,
				}
			},
			operation: func(repo Repository, cloned bool) error {
				return errors.New("operation failed")
			},
			expectedError: "operation failed",
		},
		{
			name: "push failure",
			setupMocks: func(t *testing.T) *mockClonableRepo {
				mockRepo := NewMockClonableRepository(t)
				mockCloned := NewMockClonedRepository(t)

				mockRepo.EXPECT().Clone(mock.Anything, CloneOptions{}).Return(mockCloned, nil)
				mockCloned.EXPECT().Push(mock.Anything, PushOptions{}).Return(errors.New("push failed"))
				mockCloned.EXPECT().Remove(mock.Anything).Return(nil)

				return &mockClonableRepo{
					MockClonableRepository: mockRepo,
					MockClonedRepository:   mockCloned,
				}
			},
			operation: func(repo Repository, cloned bool) error {
				return nil
			},
			expectedError: "push failed",
		},
		{
			name: "remove failure should only log",
			setupMocks: func(t *testing.T) *mockClonableRepo {
				mockRepo := NewMockClonableRepository(t)
				mockCloned := NewMockClonedRepository(t)

				mockRepo.EXPECT().Clone(mock.Anything, CloneOptions{}).Return(mockCloned, nil)
				mockCloned.EXPECT().Push(mock.Anything, PushOptions{}).Return(nil)
				mockCloned.EXPECT().Remove(mock.Anything).Return(errors.New("remove failed"))

				return &mockClonableRepo{
					MockClonableRepository: mockRepo,
					MockClonedRepository:   mockCloned,
				}
			},
			operation: func(repo Repository, cloned bool) error {
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := tt.setupMocks(t)
			err := WrapWithCloneAndPushIfPossible(context.Background(), repo, CloneOptions{}, PushOptions{}, tt.operation)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

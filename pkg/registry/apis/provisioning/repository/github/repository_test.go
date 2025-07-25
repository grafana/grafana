package github

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	field "k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

func TestNewGitHub(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		token         string
		expectedError string
		expectedOwner string
		expectedRepo  string
	}{
		{
			name: "successful creation",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			token:         "token123",
			expectedError: "",
			expectedOwner: "grafana",
			expectedRepo:  "grafana",
		},
		{
			name: "invalid URL format",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "invalid-url",
						Branch: "main",
					},
				},
			},
			token:         "token123",
			expectedError: "parse owner and repo",
		},
		{
			name: "URL with .git extension",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
					},
				},
			},
			token:         "token123",
			expectedError: "",
			expectedOwner: "grafana",
			expectedRepo:  "grafana",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factory := ProvideFactory()
			factory.Client = http.DefaultClient

			gitRepo := git.NewMockGitRepository(t)

			mockSecrets := secrets.NewMockRepositorySecrets(t)

			// Call the function under test
			repo, err := NewGitHub(
				context.Background(),
				tt.config,
				gitRepo,
				factory,
				tt.token,
				mockSecrets,
			)

			// Check results
			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, repo)
			} else {
				require.NoError(t, err)
				require.NotNil(t, repo)
				assert.Equal(t, tt.expectedOwner, repo.Owner())
				assert.Equal(t, tt.expectedRepo, repo.Repo())
				concreteRepo, ok := repo.(*githubRepository)
				require.True(t, ok)
				assert.Equal(t, gitRepo, concreteRepo.GitRepository)
			}
		})
	}
}

func TestParseOwnerRepoGithub(t *testing.T) {
	tests := []struct {
		name          string
		url           string
		expectedOwner string
		expectedRepo  string
		expectedError string
	}{
		{
			name:          "valid GitHub URL",
			url:           "https://github.com/grafana/grafana",
			expectedOwner: "grafana",
			expectedRepo:  "grafana",
		},
		{
			name:          "valid GitHub URL with .git",
			url:           "https://github.com/grafana/grafana.git",
			expectedOwner: "grafana",
			expectedRepo:  "grafana",
		},
		{
			name:          "invalid URL format",
			url:           "invalid-url",
			expectedError: "parse",
		},
		{
			name:          "missing repo name",
			url:           "https://github.com/grafana",
			expectedError: "unable to parse repo+owner from url",
		},
		{
			name:          "URL with special characters",
			url:           "https://github.com/user%",
			expectedError: "parse",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			owner, repo, err := ParseOwnerRepoGithub(tt.url)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedOwner, owner)
				assert.Equal(t, tt.expectedRepo, repo)
			}
		})
	}
}

func TestGitHubRepositoryValidate(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		mockSetup      func(m *git.MockGitRepository)
		expectedErrors int
		errorFields    []string
	}{
		{
			name: "valid configuration",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			mockSetup: func(m *git.MockGitRepository) {
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/grafana/grafana",
							Branch: "main",
							Token:  "valid-token",
							Path:   "dashboards",
						},
					},
				})
				m.On("Validate").Return(field.ErrorList{})
			},
			expectedErrors: 0,
		},
		{
			name: "missing GitHub config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: nil,
				},
			},
			mockSetup: func(m *git.MockGitRepository) {
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: nil,
					},
				})
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github"},
		},
		{
			name: "missing URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(m *git.MockGitRepository) {
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "",
							Branch: "main",
							Token:  "valid-token",
						},
					},
				})
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "invalid URL format",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "invalid-url",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(m *git.MockGitRepository) {
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "invalid-url",
							Branch: "main",
							Token:  "valid-token",
						},
					},
				})
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "non-GitHub URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://gitlab.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(m *git.MockGitRepository) {
				m.On("Config").Return(&provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://gitlab.com/grafana/grafana",
							Branch: "main",
							Token:  "valid-token",
						},
					},
				})
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockGitRepo := git.NewMockGitRepository(t)
			if tt.mockSetup != nil {
				tt.mockSetup(mockGitRepo)
			}

			repo := &githubRepository{
				config:        tt.config,
				GitRepository: mockGitRepo,
			}

			errors := repo.Validate()

			assert.Equal(t, tt.expectedErrors, len(errors), "Expected %d errors, got %d, errors: %v", tt.expectedErrors, len(errors), errors)

			if tt.expectedErrors > 0 {
				errorFields := make([]string, 0, len(errors))
				for _, err := range errors {
					errorFields = append(errorFields, err.Field)
				}
				for _, expectedField := range tt.errorFields {
					assert.Contains(t, errorFields, expectedField, "Expected error for field %s", expectedField)
				}
			}

			mockGitRepo.AssertExpectations(t)
		})
	}
}

func TestGitHubRepositoryTest(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		mockSetup      func(m *git.MockGitRepository)
		expectedResult *provisioning.TestResults
		expectedError  error
	}{
		{
			name: "successful test",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(m *git.MockGitRepository) {
				m.On("Test", mock.Anything).Return(&provisioning.TestResults{
					Code:    http.StatusOK,
					Success: true,
				}, nil)
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusOK,
				Success: true,
			},
		},
		{
			name: "invalid URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "invalid-url",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(_ *git.MockGitRepository) {
				// No mock calls expected as validation fails first
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.github.url",
					Detail: "parse \"invalid-url\": invalid URI for request",
				}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockGitRepo := git.NewMockGitRepository(t)
			if tt.mockSetup != nil {
				tt.mockSetup(mockGitRepo)
			}

			repo := &githubRepository{
				config:        tt.config,
				GitRepository: mockGitRepo,
				owner:         "grafana",
				repo:          "grafana",
			}

			result, err := repo.Test(context.Background())

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}

			if tt.expectedResult != nil {
				assert.Equal(t, tt.expectedResult.Code, result.Code)
				assert.Equal(t, tt.expectedResult.Success, result.Success)
				if len(tt.expectedResult.Errors) > 0 {
					assert.Equal(t, len(tt.expectedResult.Errors), len(result.Errors))
					for i, expectedError := range tt.expectedResult.Errors {
						assert.Equal(t, expectedError.Type, result.Errors[i].Type)
						assert.Equal(t, expectedError.Field, result.Errors[i].Field)
						assert.Contains(t, result.Errors[i].Detail, "parse")
					}
				}
			}

			mockGitRepo.AssertExpectations(t)
		})
	}
}

func TestGitHubRepositoryHistory(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		path           string
		ref            string
		mockSetup      func(m *MockClient)
		expectedResult []provisioning.HistoryItem
		expectedError  error
	}{
		{
			name: "successful history retrieval",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "dashboards",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(m *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						Committer: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}
				m.On("Commits", mock.Anything, "grafana", "grafana", "dashboards/dashboard.json", "main").
					Return(commits, nil)
			},
			expectedResult: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "file not found",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "dashboards",
					},
				},
			},
			path: "nonexistent.json",
			ref:  "main",
			mockSetup: func(m *MockClient) {
				m.On("Commits", mock.Anything, "grafana", "grafana", "dashboards/nonexistent.json", "main").
					Return(nil, ErrResourceNotFound)
			},
			expectedError: repository.ErrFileNotFound,
		},
		{
			name: "use default branch when ref is empty",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "dashboards",
					},
				},
			},
			path: "dashboard.json",
			ref:  "",
			mockSetup: func(m *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}
				m.On("Commits", mock.Anything, "grafana", "grafana", "dashboards/dashboard.json", "main").
					Return(commits, nil)
			},
			expectedResult: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "committer different from author",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "dashboards",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(m *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						Committer: &CommitAuthor{
							Name:      "Jane Smith",
							Username:  "janesmith",
							AvatarURL: "https://example.com/avatar2.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}
				m.On("Commits", mock.Anything, "grafana", "grafana", "dashboards/dashboard.json", "main").
					Return(commits, nil)
			},
			expectedResult: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						{
							Name:      "Jane Smith",
							Username:  "janesmith",
							AvatarURL: "https://example.com/avatar2.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "commit with no author",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "dashboards",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(m *MockClient) {
				commits := []Commit{
					{
						Ref:       "abc123",
						Message:   "Update dashboard",
						Author:    nil,
						Committer: nil,
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}
				m.On("Commits", mock.Anything, "grafana", "grafana", "dashboards/dashboard.json", "main").
					Return(commits, nil)
			},
			expectedResult: []provisioning.HistoryItem{
				{
					Ref:       "abc123",
					Message:   "Update dashboard",
					Authors:   []provisioning.Author{},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "other API error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "dashboards",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(m *MockClient) {
				m.On("Commits", mock.Anything, "grafana", "grafana", "dashboards/dashboard.json", "main").
					Return(nil, errors.New("API error"))
			},
			expectedError: errors.New("get commits: API error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := NewMockClient(t)
			if tt.mockSetup != nil {
				tt.mockSetup(mockClient)
			}

			repo := &githubRepository{
				config: tt.config,
				gh:     mockClient,
				owner:  "grafana",
				repo:   "grafana",
			}

			history, err := repo.History(context.Background(), tt.path, tt.ref)

			if tt.expectedError != nil {
				require.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.expectedError, &statusErr) {
					var actualStatusErr *apierrors.StatusError
					require.True(t, errors.As(err, &actualStatusErr))
					require.Equal(t, statusErr.Status().Code, actualStatusErr.Status().Code)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedResult, history)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestGitHubRepositoryResourceURLs(t *testing.T) {
	tests := []struct {
		name          string
		file          *repository.FileInfo
		config        *provisioning.Repository
		expectedURLs  *provisioning.ResourceURLs
		expectedError error
	}{
		{
			name: "file with ref",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "feature-branch",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs: &provisioning.ResourceURLs{
				RepositoryURL:     "https://github.com/grafana/grafana",
				SourceURL:         "https://github.com/grafana/grafana/blob/feature-branch/dashboards/test.json",
				CompareURL:        "https://github.com/grafana/grafana/compare/main...feature-branch",
				NewPullRequestURL: "https://github.com/grafana/grafana/compare/main...feature-branch?quick_pull=1&labels=grafana",
			},
		},
		{
			name: "file without ref uses default branch",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs: &provisioning.ResourceURLs{
				RepositoryURL: "https://github.com/grafana/grafana",
				SourceURL:     "https://github.com/grafana/grafana/blob/main/dashboards/test.json",
			},
		},
		{
			name: "empty path returns nil",
			file: &repository.FileInfo{
				Path: "",
				Ref:  "feature-branch",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs: nil,
		},
		{
			name: "nil github config returns nil",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "feature-branch",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: nil,
				},
			},
			expectedURLs: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &githubRepository{
				config: tt.config,
				owner:  "grafana",
				repo:   "grafana",
			}

			urls, err := repo.ResourceURLs(context.Background(), tt.file)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedURLs, urls)
			}
		})
	}
}

// Test simple delegation functions
func TestGitHubRepositoryDelegation(t *testing.T) {
	ctx := context.Background()

	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/grafana",
				Branch: "main",
				Token:  "test-token",
			},
		},
	}

	t.Run("Config delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		mockGitRepo.On("Config").Return(config)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result := repo.Config()
		assert.Equal(t, config, result)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("Read delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		expectedFileInfo := &repository.FileInfo{
			Path: "test.yaml",
			Data: []byte("test data"),
			Ref:  "main",
			Hash: "abc123",
		}
		mockGitRepo.On("Read", ctx, "test.yaml", "main").Return(expectedFileInfo, nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result, err := repo.Read(ctx, "test.yaml", "main")
		require.NoError(t, err)
		assert.Equal(t, expectedFileInfo, result)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("ReadTree delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		expectedEntries := []repository.FileTreeEntry{
			{Path: "file1.yaml", Size: 100, Hash: "hash1", Blob: true},
		}
		mockGitRepo.On("ReadTree", ctx, "main").Return(expectedEntries, nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result, err := repo.ReadTree(ctx, "main")
		require.NoError(t, err)
		assert.Equal(t, expectedEntries, result)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("Create delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		data := []byte("test content")
		mockGitRepo.On("Create", ctx, "new-file.yaml", "main", data, "Create new file").Return(nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		err := repo.Create(ctx, "new-file.yaml", "main", data, "Create new file")
		require.NoError(t, err)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("Update delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		data := []byte("updated content")
		mockGitRepo.On("Update", ctx, "existing-file.yaml", "main", data, "Update file").Return(nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		err := repo.Update(ctx, "existing-file.yaml", "main", data, "Update file")
		require.NoError(t, err)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("Write delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		data := []byte("file content")
		mockGitRepo.On("Write", ctx, "file.yaml", "main", data, "Write file").Return(nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		err := repo.Write(ctx, "file.yaml", "main", data, "Write file")
		require.NoError(t, err)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("Delete delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		mockGitRepo.On("Delete", ctx, "file.yaml", "main", "Delete file").Return(nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		err := repo.Delete(ctx, "file.yaml", "main", "Delete file")
		require.NoError(t, err)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("LatestRef delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		expectedRef := "abc123def456"
		mockGitRepo.On("LatestRef", ctx).Return(expectedRef, nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result, err := repo.LatestRef(ctx)
		require.NoError(t, err)
		assert.Equal(t, expectedRef, result)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("ListRefs delegates to git repo but adds ref URL", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		// The git repo returns refs without RefURL
		gitRepoRefs := []provisioning.RefItem{
			{Name: "main", Hash: "abc123def456"},
			{Name: "feature", Hash: "def456ghi789"},
		}
		mockGitRepo.On("ListRefs", ctx).Return(gitRepoRefs, nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result, err := repo.ListRefs(ctx)
		require.NoError(t, err)

		// The returned refs should have RefURL set
		expectedRefs := []provisioning.RefItem{
			{
				Name:   "main",
				Hash:   "abc123def456",
				RefURL: "https://github.com/grafana/grafana/tree/main",
			},
			{
				Name:   "feature",
				Hash:   "def456ghi789",
				RefURL: "https://github.com/grafana/grafana/tree/feature",
			},
		}
		assert.Equal(t, expectedRefs, result)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("CompareFiles delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		expectedChanges := []repository.VersionedFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "new-file.yaml",
				Ref:    "feature-branch",
			},
		}
		mockGitRepo.On("CompareFiles", ctx, "main", "feature-branch").Return(expectedChanges, nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result, err := repo.CompareFiles(ctx, "main", "feature-branch")
		require.NoError(t, err)
		assert.Equal(t, expectedChanges, result)
		mockGitRepo.AssertExpectations(t)
	})

	t.Run("Stage delegates to git repo", func(t *testing.T) {
		mockGitRepo := git.NewMockGitRepository(t)
		mockStagedRepo := repository.NewMockStagedRepository(t)
		opts := repository.StageOptions{
			Mode:    repository.StageModeCommitOnEach,
			Timeout: 10 * time.Second,
		}
		mockGitRepo.On("Stage", ctx, opts).Return(mockStagedRepo, nil)

		repo := &githubRepository{
			config:        config,
			GitRepository: mockGitRepo,
		}

		result, err := repo.Stage(ctx, opts)
		require.NoError(t, err)
		assert.Equal(t, mockStagedRepo, result)
		mockGitRepo.AssertExpectations(t)
	})
}

// Test GitHub-specific accessor methods
func TestGitHubRepositoryAccessors(t *testing.T) {
	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/grafana",
				Branch: "main",
				Token:  "test-token",
			},
		},
	}

	t.Run("Owner returns correct owner", func(t *testing.T) {
		repo := &githubRepository{
			config: config,
			owner:  "grafana",
			repo:   "grafana",
		}

		result := repo.Owner()
		assert.Equal(t, "grafana", result)
	})

	t.Run("Repo returns correct repo", func(t *testing.T) {
		repo := &githubRepository{
			config: config,
			owner:  "grafana",
			repo:   "grafana",
		}

		result := repo.Repo()
		assert.Equal(t, "grafana", result)
	})

	t.Run("Client returns correct client", func(t *testing.T) {
		mockClient := NewMockClient(t)

		repo := &githubRepository{
			config: config,
			gh:     mockClient,
			owner:  "grafana",
			repo:   "grafana",
		}

		result := repo.Client()
		assert.Equal(t, mockClient, result)
	})
}

func TestGitHubRepository_OnDelete(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(*secrets.MockRepositorySecrets)
		config        *provisioning.Repository
		expectedError string
	}{
		{
			name: "successful secret deletion",
			setupMock: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Delete(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
					},
					"test-repo"+githubTokenSecretSuffix,
				).Return(nil)
			},
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
			},
		},
		{
			name: "secret deletion error",
			setupMock: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Delete(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
					},
					"test-repo"+githubTokenSecretSuffix,
				).Return(errors.New("failed to delete secret"))
			},
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
			},
			expectedError: "delete github token secret: failed to delete secret",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecrets := secrets.NewMockRepositorySecrets(t)
			tt.setupMock(mockSecrets)

			githubRepo := &githubRepository{
				config:  tt.config,
				secrets: mockSecrets,
			}

			err := githubRepo.OnDelete(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockSecrets.AssertExpectations(t)
		})
	}
}

func TestGithubRepository_Move(t *testing.T) {
	tests := []struct {
		name        string
		oldPath     string
		newPath     string
		ref         string
		comment     string
		setupMock   func(*git.MockGitRepository)
		expectedErr error
	}{
		{
			name:    "successful move delegates to git repository",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "main",
			comment: "move file",
			setupMock: func(mockGitRepo *git.MockGitRepository) {
				mockGitRepo.EXPECT().Move(context.Background(), "old.yaml", "new.yaml", "main", "move file").Return(nil)
			},
			expectedErr: nil,
		},
		{
			name:    "move error from git repository",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "main",
			comment: "move file",
			setupMock: func(mockGitRepo *git.MockGitRepository) {
				mockGitRepo.EXPECT().Move(context.Background(), "old.yaml", "new.yaml", "main", "move file").Return(errors.New("git move failed"))
			},
			expectedErr: errors.New("git move failed"),
		},
		{
			name:    "successful directory move",
			oldPath: "old/",
			newPath: "new/",
			ref:     "main",
			comment: "move directory",
			setupMock: func(mockGitRepo *git.MockGitRepository) {
				mockGitRepo.EXPECT().Move(context.Background(), "old/", "new/", "main", "move directory").Return(nil)
			},
			expectedErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock git repository
			mockGitRepo := git.NewMockGitRepository(t)
			mockSecrets := &secrets.MockRepositorySecrets{}

			// Setup mock expectations
			tt.setupMock(mockGitRepo)

			// Create GitHub repository
			config := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL: "https://github.com/example/repo",
					},
				},
			}

			githubRepo := &githubRepository{
				config:        config,
				GitRepository: mockGitRepo,
				owner:         "example",
				repo:          "repo",
				secrets:       mockSecrets,
			}

			// Execute move operation
			err := githubRepo.Move(context.Background(), tt.oldPath, tt.newPath, tt.ref, tt.comment)

			// Verify results
			if tt.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tt.expectedErr.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

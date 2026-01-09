package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// mockRepositoryLister is a mock implementation of RepositoryLister for testing
type mockRepositoryLister struct {
	repositories []provisioning.Repository
	listErr      error
	// Track the field selector used in List calls
	lastFieldSelector fields.Selector
}

func (m *mockRepositoryLister) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}

	// Store the field selector for verification
	m.lastFieldSelector = options.FieldSelector

	// Filter repositories based on field selector if present
	filteredRepos := m.repositories
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		filteredRepos = make([]provisioning.Repository, 0)
		for _, repo := range m.repositories {
			// Simulate field selector matching for spec.connection.name
			repoFields := fields.Set{
				"spec.connection.name": getRepoConnectionName(&repo),
			}
			if options.FieldSelector.Matches(repoFields) {
				filteredRepos = append(filteredRepos, repo)
			}
		}
	}

	return &provisioning.RepositoryList{
		Items: filteredRepos,
	}, nil
}

func getRepoConnectionName(repo *provisioning.Repository) string {
	if repo.Spec.Connection == nil {
		return ""
	}
	return repo.Spec.Connection.Name
}

func TestGetRepositoriesByConnection(t *testing.T) {
	tests := []struct {
		name           string
		repositories   []provisioning.Repository
		connectionName string
		expectedCount  int
		expectedNames  []string
		expectedErr    bool
	}{
		{
			name:           "empty repository list returns empty",
			repositories:   []provisioning.Repository{},
			connectionName: "test-conn",
			expectedCount:  0,
			expectedNames:  []string{},
		},
		{
			name: "finds single matching repository",
			repositories: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "conn-a"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-2"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "conn-b"},
					},
				},
			},
			connectionName: "conn-a",
			expectedCount:  1,
			expectedNames:  []string{"repo-1"},
		},
		{
			name: "finds multiple matching repositories",
			repositories: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "shared-conn"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-2"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "shared-conn"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-3"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "different-conn"},
					},
				},
			},
			connectionName: "shared-conn",
			expectedCount:  2,
			expectedNames:  []string{"repo-1", "repo-2"},
		},
		{
			name: "no matches returns empty list",
			repositories: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "conn-a"},
					},
				},
			},
			connectionName: "non-existent",
			expectedCount:  0,
			expectedNames:  []string{},
		},
		{
			name: "empty connection name matches repos without connection",
			repositories: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-with-conn"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "some-conn"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-without-conn"},
					Spec: provisioning.RepositorySpec{
						Connection: nil,
					},
				},
			},
			connectionName: "",
			expectedCount:  1,
			expectedNames:  []string{"repo-without-conn"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockRepositoryLister{repositories: tt.repositories}
			ctx := context.Background()

			repos, err := GetRepositoriesByConnection(ctx, mock, tt.connectionName)

			if tt.expectedErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Len(t, repos, tt.expectedCount)

			// Verify the field selector was used
			require.NotNil(t, mock.lastFieldSelector, "field selector should have been set")
			expectedSelector := fields.OneTermEqualSelector("spec.connection.name", tt.connectionName)
			assert.Equal(t, expectedSelector.String(), mock.lastFieldSelector.String())

			// Verify the correct repositories were returned
			actualNames := make([]string, len(repos))
			for i, repo := range repos {
				actualNames[i] = repo.Name
			}
			for _, expectedName := range tt.expectedNames {
				assert.Contains(t, actualNames, expectedName)
			}
		})
	}
}

func TestGetRepositoriesByConnection_ListError(t *testing.T) {
	mock := &mockRepositoryLister{
		listErr: assert.AnError,
	}
	ctx := context.Background()

	repos, err := GetRepositoriesByConnection(ctx, mock, "any-conn")

	require.Error(t, err)
	assert.Nil(t, repos)
}

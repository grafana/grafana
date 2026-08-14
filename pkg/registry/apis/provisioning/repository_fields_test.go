package provisioning

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestGetConnectionName(t *testing.T) {
	tests := []struct {
		name     string
		repo     *provisioning.Repository
		expected string
	}{
		{
			name:     "nil repository returns empty string",
			repo:     nil,
			expected: "",
		},
		{
			name: "repository without connection returns empty string",
			repo: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Title: "test-repo",
				},
			},
			expected: "",
		},
		{
			name: "repository with connection returns connection name",
			repo: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Title: "test-repo",
					Connection: &provisioning.ConnectionInfo{
						Name: "my-connection",
					},
				},
			},
			expected: "my-connection",
		},
		{
			name: "repository with empty connection name returns empty string",
			repo: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Title: "test-repo",
					Connection: &provisioning.ConnectionInfo{
						Name: "",
					},
				},
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getConnectionName(tt.repo)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRepositoryToSelectableFields(t *testing.T) {
	tests := []struct {
		name           string
		repo           *provisioning.Repository
		expectedFields map[string]string
	}{
		{
			name: "includes metadata.name and metadata.namespace",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Test Repository",
				},
			},
			expectedFields: map[string]string{
				"metadata.name":        "test-repo",
				"metadata.namespace":   "default",
				"spec.connection.name": "",
			},
		},
		{
			name: "includes spec.connection.name when set",
			repo: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo-with-connection",
					Namespace: "org-1",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Repo With Connection",
					Connection: &provisioning.ConnectionInfo{
						Name: "github-connection",
					},
				},
			},
			expectedFields: map[string]string{
				"metadata.name":        "repo-with-connection",
				"metadata.namespace":   "org-1",
				"spec.connection.name": "github-connection",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fields := RepositoryToSelectableFields(tt.repo)

			for key, expectedValue := range tt.expectedFields {
				actualValue, exists := fields[key]
				assert.True(t, exists, "field %s should exist", key)
				assert.Equal(t, expectedValue, actualValue, "field %s should have correct value", key)
			}
		})
	}
}

func TestRepositoryGetAttrs(t *testing.T) {
	t.Run("returns error for non-Repository object", func(t *testing.T) {
		// Pass a different runtime.Object type instead of a Repository
		connection := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{
				Name: "not-a-repository",
			},
		}
		_, _, err := RepositoryGetAttrs(connection)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a Repository")
	})

	t.Run("returns labels and fields for valid Repository", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-repo",
				Namespace: "default",
				Labels: map[string]string{
					"app": "grafana",
					"env": "test",
				},
			},
			Spec: provisioning.RepositorySpec{
				Title: "Test Repository",
				Connection: &provisioning.ConnectionInfo{
					Name: "my-connection",
				},
			},
		}

		labels, fields, err := RepositoryGetAttrs(repo)
		require.NoError(t, err)

		// Check labels
		assert.Equal(t, "grafana", labels["app"])
		assert.Equal(t, "test", labels["env"])

		// Check fields
		assert.Equal(t, "test-repo", fields["metadata.name"])
		assert.Equal(t, "default", fields["metadata.namespace"])
		assert.Equal(t, "my-connection", fields["spec.connection.name"])
	})

	t.Run("returns empty connection name when not set", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-repo",
				Namespace: "default",
			},
			Spec: provisioning.RepositorySpec{
				Title: "Test Repository",
			},
		}

		_, fields, err := RepositoryGetAttrs(repo)
		require.NoError(t, err)
		assert.Equal(t, "", fields["spec.connection.name"])
	})
}

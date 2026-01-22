package connection

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// mockRepoByConnectionLister is a mock implementation of RepositoryByConnectionLister for testing
type mockRepoByConnectionLister struct {
	repos []provisioning.Repository
	err   error
}

func (m *mockRepoByConnectionLister) List(ctx context.Context) ([]provisioning.Repository, error) {
	return m.repos, m.err
}

func (m *mockRepoByConnectionLister) ListByConnection(ctx context.Context, connectionName string) ([]provisioning.Repository, error) {
	if m.err != nil {
		return nil, m.err
	}

	// Filter repos by connection name
	var filtered []provisioning.Repository
	for _, repo := range m.repos {
		if repo.Spec.Connection != nil && repo.Spec.Connection.Name == connectionName {
			filtered = append(filtered, repo)
		}
	}
	return filtered, nil
}

func newDeleteValidatorTestAttributes(name string) admission.Attributes {
	return admission.NewAttributesRecord(
		nil, // obj is nil for delete operations
		nil,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		"default",
		name,
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		"",
		admission.Delete,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestNewDeleteValidator(t *testing.T) {
	lister := &mockRepoByConnectionLister{}
	v := NewDeleteValidator(lister)
	require.NotNil(t, v)
	assert.Equal(t, lister, v.repoLister)
}

func TestDeleteValidator_ValidateDelete(t *testing.T) {
	tests := []struct {
		name            string
		connectionName  string
		repos           []provisioning.Repository
		listerErr       error
		wantErr         bool
		wantForbidden   bool
		wantErrContains string
	}{
		{
			name:           "allows deletion when no repositories reference connection",
			connectionName: "test-connection",
			repos:          []provisioning.Repository{},
			wantErr:        false,
		},
		{
			name:           "blocks deletion when one repository references connection",
			connectionName: "test-connection",
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "test-connection"},
					},
				},
			},
			wantErr:         true,
			wantForbidden:   true,
			wantErrContains: "referenced by 1 repository(s): [repo-1]",
		},
		{
			name:           "blocks deletion when multiple repositories reference connection",
			connectionName: "test-connection",
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "test-connection"},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-2"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "test-connection"},
					},
				},
			},
			wantErr:         true,
			wantForbidden:   true,
			wantErrContains: "referenced by 2 repository(s)",
		},
		{
			name:           "allows deletion when repositories reference different connections",
			connectionName: "test-connection",
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "other-connection"},
					},
				},
			},
			wantErr: false,
		},
		{
			name:           "allows deletion when repositories have no connection",
			connectionName: "test-connection",
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						// No connection set
					},
				},
			},
			wantErr: false,
		},
		{
			name:            "returns error when lister fails",
			connectionName:  "test-connection",
			listerErr:       errors.New("storage error"),
			wantErr:         true,
			wantErrContains: "failed to check for referencing repositories",
		},
		{
			name:           "allows deletion when connection name is empty",
			connectionName: "",
			wantErr:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lister := &mockRepoByConnectionLister{
				repos: tt.repos,
				err:   tt.listerErr,
			}
			v := NewDeleteValidator(lister)

			attr := newDeleteValidatorTestAttributes(tt.connectionName)
			err := v.ValidateDelete(context.Background(), attr, nil)

			if tt.wantErr {
				require.Error(t, err)
				if tt.wantErrContains != "" {
					assert.Contains(t, err.Error(), tt.wantErrContains)
				}
				if tt.wantForbidden {
					assert.True(t, apierrors.IsForbidden(err), "expected Forbidden error, got: %v", err)
				}
				return
			}

			require.NoError(t, err)
		})
	}
}

func TestDeleteValidator_ValidateDelete_ErrorMessage(t *testing.T) {
	lister := &mockRepoByConnectionLister{
		repos: []provisioning.Repository{
			{
				ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
				Spec: provisioning.RepositorySpec{
					Connection: &provisioning.ConnectionInfo{Name: "my-connection"},
				},
			},
		},
	}
	v := NewDeleteValidator(lister)

	attr := newDeleteValidatorTestAttributes("my-connection")
	err := v.ValidateDelete(context.Background(), attr, nil)

	require.Error(t, err)

	// Verify the error is a Forbidden error with the correct resource info
	statusErr, ok := err.(*apierrors.StatusError)
	require.True(t, ok, "expected StatusError")
	assert.Equal(t, int32(403), statusErr.ErrStatus.Code)
	assert.Contains(t, statusErr.ErrStatus.Message, "my-connection")
	assert.Contains(t, statusErr.ErrStatus.Message, "my-repo")
}

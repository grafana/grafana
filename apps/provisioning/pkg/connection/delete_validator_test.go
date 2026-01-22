package connection

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
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

func newDeleteValidatorTestAttributes(name, namespace string, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		nil, // obj is nil for delete operations
		nil,
		provisioning.ConnectionResourceInfo.GroupVersionKind(),
		namespace,
		name,
		provisioning.ConnectionResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestNewReferencedByRepositoriesValidator(t *testing.T) {
	lister := &mockRepoByConnectionLister{}
	v := NewReferencedByRepositoriesValidator(lister)
	require.NotNil(t, v)

	// Verify it implements Validator interface
	var _ Validator = v
}

func TestReferencedByRepositoriesValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		connectionName  string
		namespace       string
		operation       admission.Operation
		repos           []provisioning.Repository
		listerErr       error
		wantErrors      bool
		wantErrType     field.ErrorType
		wantErrContains string
	}{
		{
			name:           "allows deletion when no repositories reference connection",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Delete,
			repos:          []provisioning.Repository{},
			wantErrors:     false,
		},
		{
			name:           "blocks deletion when one repository references connection",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Delete,
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "test-connection"},
					},
				},
			},
			wantErrors:      true,
			wantErrType:     field.ErrorTypeForbidden,
			wantErrContains: "referenced by 1 repository(s): [repo-1]",
		},
		{
			name:           "blocks deletion when multiple repositories reference connection",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Delete,
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
			wantErrors:      true,
			wantErrType:     field.ErrorTypeForbidden,
			wantErrContains: "referenced by 2 repository(s)",
		},
		{
			name:           "allows deletion when repositories reference different connections",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Delete,
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "other-connection"},
					},
				},
			},
			wantErrors: false,
		},
		{
			name:           "allows deletion when repositories have no connection",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Delete,
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						// No connection set
					},
				},
			},
			wantErrors: false,
		},
		{
			name:            "returns error when lister fails",
			connectionName:  "test-connection",
			namespace:       "default",
			operation:       admission.Delete,
			listerErr:       errors.New("storage error"),
			wantErrors:      true,
			wantErrType:     field.ErrorTypeInternal,
			wantErrContains: "failed to check for referencing repositories",
		},
		{
			name:           "allows deletion when connection name is empty",
			connectionName: "",
			namespace:      "default",
			operation:      admission.Delete,
			wantErrors:     false,
		},
		{
			name:           "skips validation for create operation",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Create,
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "test-connection"},
					},
				},
			},
			wantErrors: false,
		},
		{
			name:           "skips validation for update operation",
			connectionName: "test-connection",
			namespace:      "default",
			operation:      admission.Update,
			repos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "repo-1"},
					Spec: provisioning.RepositorySpec{
						Connection: &provisioning.ConnectionInfo{Name: "test-connection"},
					},
				},
			},
			wantErrors: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lister := &mockRepoByConnectionLister{
				repos: tt.repos,
				err:   tt.listerErr,
			}
			v := NewReferencedByRepositoriesValidator(lister)

			attr := newDeleteValidatorTestAttributes(tt.connectionName, tt.namespace, tt.operation)
			errs := v.Validate(context.Background(), attr)

			if tt.wantErrors {
				require.NotEmpty(t, errs, "expected validation errors")
				if tt.wantErrContains != "" {
					assert.Contains(t, errs[0].Detail, tt.wantErrContains)
				}
				if tt.wantErrType != "" {
					assert.Equal(t, tt.wantErrType, errs[0].Type)
				}
				return
			}

			require.Empty(t, errs, "expected no validation errors")
		})
	}
}

func TestReferencedByRepositoriesValidator_Validate_ErrorDetails(t *testing.T) {
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
	v := NewReferencedByRepositoriesValidator(lister)

	attr := newDeleteValidatorTestAttributes("my-connection", "default", admission.Delete)
	errs := v.Validate(context.Background(), attr)

	require.Len(t, errs, 1)
	assert.Equal(t, field.ErrorTypeForbidden, errs[0].Type)
	assert.Equal(t, "metadata.name", errs[0].Field)
	assert.Contains(t, errs[0].Detail, "my-repo")
	assert.Contains(t, errs[0].Detail, "cannot delete connection")
}

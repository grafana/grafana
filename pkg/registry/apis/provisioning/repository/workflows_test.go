package repository

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func TestIsWriteAllowed(t *testing.T) {
	tests := []struct {
		name        string
		repository  *provisioning.Repository
		ref         string
		wantErr     bool
		expectedErr string
		statusCode  int32
	}{
		{
			name: "read only repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{},
				},
			},
			wantErr:     true,
			expectedErr: "this repository is read only",
			statusCode:  http.StatusBadRequest,
		},
		{
			name: "write workflow allowed",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			ref:     "",
			wantErr: false,
		},
		{
			name: "write allowed for configured branch of github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "feature-branch",
					},
				},
			},
			ref:     "feature-branch",
			wantErr: false,
		},
		{
			name: "write not allowed for configured branch of github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "feature-branch",
					},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "this repository does not support the write workflow",
			statusCode:  http.StatusBadRequest,
		},
		{
			name: "write workflow not allowed for github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "feature-branch",
					},
				},
			},
			ref:         "",
			wantErr:     true,
			expectedErr: "this repository does not support the write workflow",
			statusCode:  http.StatusBadRequest,
		},
		{
			name: "write workflow not allowed",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				},
			},
			wantErr:     true,
			expectedErr: "this repository does not support the write workflow",
			statusCode:  http.StatusBadRequest,
		},
		{
			name: "branch workflow on non-github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.LocalRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "this repository does not support the branch workflow",
			statusCode:  http.StatusBadRequest,
		},
		{
			name: "branch workflow allowed on github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				},
			},
			ref:     "feature-branch",
			wantErr: false,
		},
		{
			name: "branch workflow not allowed on github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "this repository does not support the branch workflow",
			statusCode:  http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := IsWriteAllowed(tt.repository, tt.ref)
			if tt.wantErr {
				require.Error(t, err)
				require.Equal(t, tt.expectedErr, err.Error())

				var (
					statusErr *apierrors.StatusError
					apiStatus apierrors.APIStatus
				)
				switch {
				case errors.As(err, &statusErr):
					require.Equal(t, tt.statusCode, statusErr.Status().Code)
				case errors.As(err, &apiStatus):
					require.Equal(t, tt.statusCode, apiStatus.Status().Code)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

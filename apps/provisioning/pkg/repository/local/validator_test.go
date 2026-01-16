package local

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

func TestValidate(t *testing.T) {
	resolver := &LocalFolderResolver{
		PermittedPrefixes: []string{"/tmp/allowed"},
		HomePath:          safepath.Clean("/tmp"),
	}

	tests := []struct {
		name          string
		obj           runtime.Object
		resolver      *LocalFolderResolver
		expectedError bool
		errorContains []string
	}{
		{
			name: "non-repository object",
			obj:  &runtime.Unknown{},
		},
		{
			name: "non-local repository type",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
				},
			},
		},
		{
			name: "local repository type without local config",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type:  provisioning.LocalRepositoryType,
					Local: nil,
				},
			},
			resolver:      resolver,
			expectedError: true,
			errorContains: []string{"local configuration is required"},
		},
		{
			name: "missing path",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{
						Path: "",
					},
				},
			},
			resolver:      resolver,
			expectedError: true,
			errorContains: []string{"path"},
		},
		{
			name: "invalid path",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{
						Path: "../invalid",
					},
				},
			},
			resolver:      resolver,
			expectedError: true,
			errorContains: []string{"path"},
		},
		{
			name: "path not in permitted prefixes",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{
						Path: "/tmp/not-allowed",
					},
				},
			},
			resolver:      resolver,
			expectedError: true,
			errorContains: []string{"path"},
		},
		{
			name: "valid local repository",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{
						Path: "allowed/test",
					},
				},
			},
			resolver: resolver,
		},
		{
			name: "nil resolver",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{
						Path: "test",
					},
				},
			},
			resolver: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Validate(context.Background(), tt.obj, tt.resolver)
			if tt.expectedError {
				assert.Error(t, err)
				if len(tt.errorContains) > 0 {
					errStr := err.Error()
					for _, contains := range tt.errorContains {
						assert.Contains(t, errStr, contains)
					}
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

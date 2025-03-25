package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func TestLocalResolver(t *testing.T) {
	resolver := &LocalFolderResolver{
		PermittedPrefixes: []string{
			"/github/testdata",
		},
		HomePath: "/",
	}

	_, err := resolver.LocalPath("github/testdata")
	require.NoError(t, err)

	_, err = resolver.LocalPath("something")
	require.Error(t, err)
}

func TestLocal(t *testing.T) {
	// Valid paths test cases
	for _, tc := range []struct {
		Name              string
		Path              string
		PermittedPrefixes []string
		ExpectedPath      string
	}{
		{"relative path", "devenv/test", []string{"/home/grafana"}, "/home/grafana/devenv/test/"},
		{"absolute path", "/devenv/test", []string{"/devenv"}, "/devenv/test/"},
		{"relative path with multiple prefixes", "devenv/test", []string{"/home/grafana", "/devenv"}, "/home/grafana/devenv/test/"},
		{"absolute path with multiple prefixes", "/devenv/test", []string{"/home/grafana", "/devenv"}, "/devenv/test/"},
	} {
		t.Run("valid: "+tc.Name, func(t *testing.T) {
			r := NewLocal(&v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Local: &v0alpha1.LocalRepositoryConfig{
						Path: tc.Path,
					},
				},
			}, &LocalFolderResolver{PermittedPrefixes: tc.PermittedPrefixes, HomePath: "/home/grafana"})

			assert.Equal(t, tc.ExpectedPath, r.path, "expected path to be resolved")
			for _, err := range r.Validate() {
				assert.Fail(t, "unexpected validation failure", "unexpected validation error on field %s: %s", err.Field, err.ErrorBody())
			}
		})
	}

	// Invalid paths test cases
	for _, tc := range []struct {
		Name              string
		Path              string
		PermittedPrefixes []string
	}{
		{"no configured paths", "invalid/path", nil},
		{"path traversal escape", "../../etc/passwd", []string{"/home/grafana"}},
		{"unconfigured prefix", "invalid/path", []string{"devenv", "/tmp", "test"}},
	} {
		t.Run("invalid: "+tc.Name, func(t *testing.T) {
			r := NewLocal(&v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Local: &v0alpha1.LocalRepositoryConfig{
						Path: tc.Path,
					},
				},
			}, &LocalFolderResolver{PermittedPrefixes: tc.PermittedPrefixes, HomePath: "/home/grafana"})

			require.Empty(t, r.path, "no path should be resolved")

			errs := r.Validate()
			require.NotEmpty(t, errs, "expected validation errors")
			for _, err := range errs {
				if !assert.Equal(t, "spec.local.path", err.Field) {
					assert.FailNow(t, "unexpected validation failure", "unexpected validation error on field %s: %s", err.Field, err.ErrorBody())
				}
			}
		})
	}
}

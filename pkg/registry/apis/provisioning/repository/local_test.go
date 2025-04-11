package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func TestLocalResolver(t *testing.T) {
	resolver := &LocalFolderResolver{
		PermittedPrefixes: []string{
			"github",
		},
		HomePath: "./",
	}

	fullpath, err := resolver.LocalPath("github/testdata")
	require.NoError(t, err)
	require.Equal(t, "github/testdata", fullpath)

	_, err = resolver.LocalPath("something")
	require.Error(t, err)

	// Check valid errors
	r := NewLocal(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			Local: &v0alpha1.LocalRepositoryConfig{
				Path: "github",
			},
		},
	}, resolver)

	// Full tree
	tree, err := r.ReadTree(context.Background(), "")
	require.NoError(t, err)
	names := []string{}
	for _, v := range tree {
		names = append(names, v.Path)
	}
	require.Equal(t, []string{
		"client.go",
		"factory.go",
		"impl.go",
		"mock_client.go",
		"mock_commit_file.go",
		"mock_repository_content.go",
		"testdata",
		"testdata/webhook-issue_comment-created.json",
		"testdata/webhook-ping-check.json",
		"testdata/webhook-pull_request-opened.json",
		"testdata/webhook-push-different_branch.json",
		"testdata/webhook-push-nested.json",
		"testdata/webhook-push-nothing_relevant.json",
	}, names)

	v, err := r.Read(context.Background(), "testdata", "")
	require.NoError(t, err)
	require.Equal(t, "testdata", v.Path)
	require.Nil(t, v.Data)

	v, err = r.Read(context.Background(), "testdata/webhook-push-nested.json", "")
	require.NoError(t, err)
	require.Equal(t, "4eb879daca9942a887862b3d76fe9f24528d0408", v.Hash)

	// read unknown file
	_, err = r.Read(context.Background(), "testdata/missing", "")
	require.True(t, apierrors.IsNotFound(err)) // 404 error

	_, err = r.Read(context.Background(), "testdata/webhook-push-nested.json/", "")
	require.Error(t, err) // not a directory
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

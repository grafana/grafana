package repository

import (
	"context"
	"testing"

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
	t.Run("invalid path", func(t *testing.T) {
		r := NewLocal(&v0alpha1.Repository{
			Spec: v0alpha1.RepositorySpec{
				Local: &v0alpha1.LocalRepositoryConfig{
					Path: "invalid/path",
				},
			},
		}, &LocalFolderResolver{})

		// Did not resolve a local path
		require.Equal(t, "", r.path)

		// The correct fields are set
		require.Nil(t, r.Validate())

		expected := "the path given ('invalid/path') is invalid for a local repository (no permitted prefixes were configured)"

		rsp, err := r.Test(context.Background())
		require.NoError(t, err)
		require.Equal(t, false, rsp.Success)
		require.Equal(t, []string{expected}, rsp.Errors)

		// We get the same error when trying to read a file
		_, err = r.Read(context.Background(), "path/to/file", "")
		require.Equal(t, expected, err.Error())
	})
}

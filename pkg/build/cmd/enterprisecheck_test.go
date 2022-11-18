package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetCheckOpts(t *testing.T) {
	t.Run("it should return the checkOpts if the correct environment variables are set", func(t *testing.T) {
		args := []string{
			"OSS_COMMIT_SHA=1234",
			"DRONE_BUILD_LINK=http://example.com",
		}

		opts, err := getCheckOpts(args)
		require.NoError(t, err)
		require.Equal(t, opts.SHA, "1234")
		require.Equal(t, opts.URL, "http://example.com")
	})
	t.Run("it should return an error if OSS_COMMIT_SHA is not set", func(t *testing.T) {
		args := []string{
			"DRONE_BUILD_LINK=http://example.com",
		}

		opts, err := getCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
	t.Run("it should return an error if DRONE_BUILD_LINK is not set", func(t *testing.T) {
		args := []string{
			"OSS_COMMIT_SHA=1234",
		}

		opts, err := getCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
}

func TestGetCompleteCheckOpts(t *testing.T) {
	t.Run("it should return the completeCheckOpts if the correct environment variables are set", func(t *testing.T) {
		args := []string{
			"OSS_PULL_REQUEST=1234",
			"DRONE_SOURCE_BRANCH=example-branch",
		}

		opts, err := getCompleteCheckOpts(args)
		require.NoError(t, err)
		require.Equal(t, opts.prID, 1234)
		require.Equal(t, opts.branch, "example-branch")
	})
	t.Run("it should detect the pull request ID from the source branch name if possible", func(t *testing.T) {
		args := []string{
			"DRONE_SOURCE_BRANCH=pr-check-111/branch/name",
		}

		opts, err := getCompleteCheckOpts(args)
		require.NoError(t, err)
		require.Equal(t, opts.prID, 111)
		require.Equal(t, opts.branch, "pr-check-111/branch/name")
	})
	t.Run("it should return an error if OSS_PULL_REQUEST is not set", func(t *testing.T) {
		args := []string{
			"DRONE_SOURCE_BRANCH=example-branch",
		}

		opts, err := getCompleteCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
	t.Run("it should return an error if DRONE_SOURCE_BRANCH is not set", func(t *testing.T) {
		args := []string{
			"OSS_PULL_REQUEST=1234",
		}

		opts, err := getCompleteCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
}

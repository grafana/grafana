package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetCheckOpts(t *testing.T) {
	t.Run("it should return the checkOpts if the correct environment variables are set", func(t *testing.T) {
		args := []string{
			"SOURCE_COMMIT=1234",
			"DRONE_SOURCE_BRANCH=test",
			"DRONE_BUILD_LINK=http://example.com",
			"OSS_PULL_REQUEST=1",
		}

		opts, err := getCheckOpts(args)
		require.NoError(t, err)
		require.Equal(t, opts.SHA, "1234")
		require.Equal(t, opts.URL, "http://example.com")
	})
	t.Run("it should return an error if SOURCE_COMMIT is not set", func(t *testing.T) {
		args := []string{
			"DRONE_BUILD_LINK=http://example.com",
			"DRONE_SOURCE_BRANCH=test",
			"DRONE_BUILD_LINK=http://example.com",
			"OSS_PULL_REQUEST=1",
		}

		opts, err := getCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
	t.Run("it should return an error if DRONE_BUILD_LINK is not set", func(t *testing.T) {
		args := []string{
			"SOURCE_COMMIT=1234",
			"DRONE_SOURCE_BRANCH=test",
			"OSS_PULL_REQUEST=1",
		}

		opts, err := getCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
	t.Run("it should return an error if OSS_PULL_REQUEST is not set", func(t *testing.T) {
		args := []string{
			"SOURCE_COMMIT=1234",
			"DRONE_SOURCE_BRANCH=test",
			"DRONE_BUILD_LINK=http://example.com",
		}

		opts, err := getCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
	t.Run("it should return an error if OSS_PULL_REQUEST is not an integer", func(t *testing.T) {
		args := []string{
			"SOURCE_COMMIT=1234",
			"DRONE_SOURCE_BRANCH=test",
			"DRONE_BUILD_LINK=http://example.com",
			"OSS_PULL_REQUEST=http://example.com",
		}

		opts, err := getCheckOpts(args)
		require.Nil(t, opts)
		require.Error(t, err)
	})
}

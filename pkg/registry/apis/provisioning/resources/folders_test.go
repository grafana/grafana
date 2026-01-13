package resources_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/require"
)

func TestPathCreationError(t *testing.T) {
	t.Run("Error method returns formatted message", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		expectedMsg := "failed to create path grafana/folder-1: underlying error"
		require.Equal(t, expectedMsg, pathErr.Error())
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		unwrapped := pathErr.Unwrap()
		require.Equal(t, underlyingErr, unwrapped)
		require.EqualError(t, unwrapped, "underlying error")
	})

	t.Run("errors.Is finds underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		require.True(t, errors.Is(pathErr, underlyingErr))
		require.False(t, errors.Is(pathErr, fmt.Errorf("different error")))
	})

	t.Run("errors.As extracts PathCreationError", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &resources.PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		var extractedErr *resources.PathCreationError
		require.True(t, errors.As(pathErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, "grafana/folder-1", extractedErr.Path)
		require.Equal(t, underlyingErr, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-PathCreationError", func(t *testing.T) {
		regularErr := fmt.Errorf("regular error")

		var extractedErr *resources.PathCreationError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})
}

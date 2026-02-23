package resources

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestResourceValidationError(t *testing.T) {
	t.Run("Error method returns formatted message with underlying error", func(t *testing.T) {
		underlyingErr := errors.New("underlying error")
		validationErr := NewResourceValidationError(underlyingErr)

		require.Equal(t, "resource validation failed: underlying error", validationErr.Error())
	})

	t.Run("Error method returns message without underlying error", func(t *testing.T) {
		validationErr := NewResourceValidationError(nil)

		// Error() includes the BadRequest error in the output, so it will be longer than just the message
		require.Contains(t, validationErr.Error(), "resource validation failed")
	})

	t.Run("Unwrap returns slice of errors for joined error", func(t *testing.T) {
		underlyingErr := errors.New("underlying error")
		validationErr := NewResourceValidationError(underlyingErr)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)
		require.Len(t, unwrapped, 2, "Unwrap should return 2 errors: the underlying error and the BadRequest")
		require.Error(t, unwrapped[0])
		require.Error(t, unwrapped[1])
		require.Equal(t, underlyingErr, unwrapped[0])
	})

	t.Run("Unwrap returns empty slice for nil error", func(t *testing.T) {
		validationErr := NewResourceValidationError(nil)

		unwrapped := validationErr.Unwrap()
		// When Err is nil, Unwrap returns []error{nil} which is a slice with one nil element
		require.NotNil(t, unwrapped)
		require.Len(t, unwrapped, 0, "Unwrap should return slice with zero elements when Err is nil")
	})

	t.Run("Unwrap returns single error wrapped in slice for non-join error", func(t *testing.T) {
		// Create a ResourceValidationError manually with a non-join error
		singleErr := errors.New("single error")
		validationErr := &ResourceValidationError{
			Err: singleErr,
		}

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)
		require.Len(t, unwrapped, 1, "Unwrap should return slice with one error for non-join error")
		require.Equal(t, singleErr, unwrapped[0], "Unwrapped error should be the original single error")
	})

	t.Run("NewResourceValidationError creates joined error with BadRequest", func(t *testing.T) {
		underlyingErr := errors.New("test error")
		validationErr := NewResourceValidationError(underlyingErr)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)
		require.Len(t, unwrapped, 2, "Unwrap should return 2 errors for joined error")

		// Check that one of the unwrapped errors is a BadRequest
		var badRequestErr *apierrors.StatusError
		foundBadRequest := false
		for _, err := range unwrapped {
			if errors.As(err, &badRequestErr) {
				foundBadRequest = true
				require.True(t, apierrors.IsBadRequest(err), "unwrapped error should be a BadRequest")
				break
			}
		}
		require.True(t, foundBadRequest, "One of the unwrapped errors should be a BadRequest")

		// Check that the underlying error is also in the unwrapped slice
		for _, err := range unwrapped {
			if errors.Is(err, underlyingErr) {
				return
			}
		}

		require.Fail(t, "the underlying error should be in the unwrapped slice")
	})

	t.Run("errors.Is finds underlying BadRequest error in joined error", func(t *testing.T) {
		underlyingErr := errors.New("test error")
		validationErr := NewResourceValidationError(underlyingErr)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)
		require.Len(t, unwrapped, 2)

		// Find the BadRequest error in the unwrapped slice
		var badRequestErr *apierrors.StatusError
		for _, err := range unwrapped {
			if errors.As(err, &badRequestErr) {
				// errors.Is should work with the unwrapped BadRequest error
				require.True(t, errors.Is(validationErr, err), "errors.Is should find the unwrapped BadRequest error")
				break
			}
		}

		// Also test with apierrors.IsBadRequest
		require.True(t, apierrors.IsBadRequest(validationErr), "apierrors.IsBadRequest should work on the validation error")
	})

	t.Run("errors.As extracts ResourceValidationError", func(t *testing.T) {
		underlyingErr := errors.New("test error")
		validationErr := NewResourceValidationError(underlyingErr)

		var extractedErr *ResourceValidationError
		require.True(t, errors.As(validationErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, validationErr.Err, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-ResourceValidationError", func(t *testing.T) {
		regularErr := errors.New("regular error")

		var extractedErr *ResourceValidationError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})

	t.Run("NewResourceValidationError with nil error has nil Err", func(t *testing.T) {
		validationErr := NewResourceValidationError(nil)

		// When nil is passed, combinedError is nil, so Err is nil
		require.Nil(t, validationErr.Err, "Err should be nil when nil error is passed")

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)
		require.Empty(t, unwrapped, "Unwrap should return a empty slice")

		// When Err is nil, there's no BadRequest in the chain, so IsBadRequest should return false
		require.False(t, apierrors.IsBadRequest(validationErr), "validation error should not be recognized as BadRequest when Err is nil")
	})
}

func TestResourceOwnershipConflictError(t *testing.T) {
	t.Run("Error method returns formatted message with manager details", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-2",
		}
		conflictErr := NewResourceOwnershipConflictError("test-resource", currentManager, requestingManager)

		require.Contains(t, conflictErr.Error(), "test-resource")
		require.Contains(t, conflictErr.Error(), "repo-1")
		require.Contains(t, conflictErr.Error(), "repo-2")
		require.Contains(t, conflictErr.Error(), "repo")
	})

	t.Run("Error method returns message with different manager kinds", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindTerraform,
			Identity: "terraform-workspace-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-1",
		}
		conflictErr := NewResourceOwnershipConflictError("dashboard-1", currentManager, requestingManager)

		require.Contains(t, conflictErr.Error(), "dashboard-1")
		require.Contains(t, conflictErr.Error(), "terraform")
		require.Contains(t, conflictErr.Error(), "terraform-workspace-1")
		require.Contains(t, conflictErr.Error(), "repo")
		require.Contains(t, conflictErr.Error(), "repo-1")
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-2",
		}
		conflictErr := NewResourceOwnershipConflictError("test-resource", currentManager, requestingManager)

		var extractedErr *ResourceOwnershipConflictError
		require.True(t, errors.As(conflictErr, &extractedErr))
		unwrapped := extractedErr.Unwrap()
		require.NotNil(t, unwrapped)
		// The unwrapped error should be a BadRequest error created by NewResourceOwnershipConflictError
		require.Error(t, unwrapped)
	})

	t.Run("NewResourceOwnershipConflictError creates BadRequest error", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-2",
		}
		conflictErr := NewResourceOwnershipConflictError("test-resource", currentManager, requestingManager)

		var extractedErr *ResourceOwnershipConflictError
		require.True(t, errors.As(conflictErr, &extractedErr))
		unwrapped := extractedErr.Unwrap()
		require.NotNil(t, unwrapped)

		// Check that the unwrapped error is a BadRequest
		var badRequestErr *apierrors.StatusError
		require.ErrorAs(t, unwrapped, &badRequestErr, "unwrapped error should be a StatusError (BadRequest)")
		require.True(t, apierrors.IsBadRequest(unwrapped), "unwrapped error should be a BadRequest")
	})

	t.Run("errors.Is finds underlying BadRequest error", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-2",
		}
		conflictErr := NewResourceOwnershipConflictError("test-resource", currentManager, requestingManager)

		var extractedErr *ResourceOwnershipConflictError
		require.True(t, errors.As(conflictErr, &extractedErr))
		unwrapped := extractedErr.Unwrap()
		require.NotNil(t, unwrapped)

		// errors.Is should work with the unwrapped BadRequest error
		require.True(t, errors.Is(conflictErr, unwrapped), "errors.Is should find the unwrapped BadRequest error")

		// Also test with apierrors.IsBadRequest
		require.True(t, apierrors.IsBadRequest(conflictErr), "apierrors.IsBadRequest should work on the conflict error")
	})

	t.Run("errors.As extracts ResourceOwnershipConflictError", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "repo-2",
		}
		conflictErr := NewResourceOwnershipConflictError("test-resource", currentManager, requestingManager)

		var extractedErr *ResourceOwnershipConflictError
		require.True(t, errors.As(conflictErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.NotNil(t, extractedErr.Err)
		require.True(t, apierrors.IsBadRequest(extractedErr.Err))
	})

	t.Run("errors.As returns false for non-ResourceOwnershipConflictError", func(t *testing.T) {
		regularErr := errors.New("regular error")

		var extractedErr *ResourceOwnershipConflictError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})

	t.Run("Error message format includes all required information", func(t *testing.T) {
		currentManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindKubectl,
			Identity: "kubectl-config-1",
		}
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindPlugin,
			Identity: "plugin-instance-1",
		}
		conflictErr := NewResourceOwnershipConflictError("my-dashboard", currentManager, requestingManager)

		errMsg := conflictErr.Error()
		require.Contains(t, errMsg, "my-dashboard")
		require.Contains(t, errMsg, "kubectl")
		require.Contains(t, errMsg, "kubectl-config-1")
		require.Contains(t, errMsg, "plugin")
		require.Contains(t, errMsg, "plugin-instance-1")
		require.Contains(t, errMsg, "cannot be modified")
	})
}

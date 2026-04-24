package jobs

import (
	"errors"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/assert"
)

func TestNewSkippedJobResourceResult(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	err := errors.New("skip reason")

	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithError(err).
		AsSkipped().
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, repository.FileActionIgnored, result.Action())
	assert.Equal(t, err, result.Warning())
	assert.Nil(t, result.Error())
}

func TestNewJobResourceResult_WithError(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionCreated
	err := errors.New("operation failed")

	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(err).
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.NotNil(t, result.Error())
	assert.Equal(t, err, result.Error())
}

func TestNewJobResourceResult_WithWarning(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionCreated

	warningErr := errors.New("some warning error")

	// Test with ParseError directly (a warning error)
	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithWarning(warningErr).
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.Nil(t, result.Error(), "error should be stored as warning, not error")
	assert.NotNil(t, result.Warning(), "error should be stored as warning")
	assert.Equal(t, warningErr, result.Warning())
}

func TestNewJobResourceResult_WithoutError(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionUpdated

	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.Nil(t, result.Error())
}

func TestNewJobResourceResult_WithFolderResult(t *testing.T) {
	path := "/test/path"
	action := repository.FileActionCreated

	result := NewFolderResult(path).WithAction(action).Build()
	assert.Equal(t, resources.FolderResource.Group, result.Group())
	assert.Equal(t, resources.FolderKind.Kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
}

func TestNewJobResourceResult_WithErrorAsWarning(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionCreated

	validationErr := resources.NewResourceValidationError(errors.New("test error"))

	// Test with ParseError directly (a warning error)
	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(validationErr).
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.Nil(t, result.Error(), "ParseError should be stored as warning, not error")
	assert.NotNil(t, result.Warning(), "ParseError should be stored as warning")
	assert.Equal(t, validationErr, result.Warning())

	// Test with an error that wraps ParseError (should also be treated as warning)
	wrappedErr := fmt.Errorf("unable to read file as a resource: %w", validationErr)

	result2 := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(wrappedErr).
		Build()

	assert.Nil(t, result2.Error(), "Error wrapping ParseError should be stored as warning, not error")
	assert.NotNil(t, result2.Warning(), "Error wrapping ParseError should be stored as warning")
}

func TestNewJobResourceResult_WithOwnershipConflictAsWarning(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionCreated

	currentManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: "repo-1",
	}
	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: "repo-2",
	}
	ownershipErr := resources.NewResourceOwnershipConflictError("test-resource", currentManager, requestingManager)

	// Test with ResourceOwnershipConflictError directly (a warning error)
	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(ownershipErr).
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.Nil(t, result.Error(), "ResourceOwnershipConflictError should be stored as warning, not error")
	assert.NotNil(t, result.Warning(), "ResourceOwnershipConflictError should be stored as warning")

	// Test with an error that wraps ResourceOwnershipConflictError (should also be treated as warning)
	wrappedErr := fmt.Errorf("writing resource from file: %w", ownershipErr)

	result2 := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(wrappedErr).
		Build()

	assert.Nil(t, result2.Error(), "Error wrapping ResourceOwnershipConflictError should be stored as warning, not error")
	assert.NotNil(t, result2.Warning(), "Error wrapping ResourceOwnershipConflictError should be stored as warning")
}

func TestNewJobResourceResult_WithUnmanagedConflictAsWarning(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionCreated

	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: "repo-1",
	}
	unmanagedErr := resources.NewResourceUnmanagedConflictError("test-resource", requestingManager)

	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(unmanagedErr).
		Build()

	assert.Nil(t, result.Error(), "ResourceUnmanagedConflictError should be stored as warning, not error")
	assert.NotNil(t, result.Warning(), "ResourceUnmanagedConflictError should be stored as warning")
	assert.Equal(t, unmanagedErr, result.Warning())

	wrappedErr := fmt.Errorf("writing resource from file: %w", unmanagedErr)

	result2 := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(wrappedErr).
		Build()

	assert.Nil(t, result2.Error(), "Error wrapping ResourceUnmanagedConflictError should be stored as warning, not error")
	assert.NotNil(t, result2.Warning(), "Error wrapping ResourceUnmanagedConflictError should be stored as warning")
}

func TestNewJobResourceResult_WithErrorAsRegularError(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionCreated
	regularErr := errors.New("operation failed")

	// Test with a regular error (not a warning error)
	result := NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind).
		WithPath(path).
		WithAction(action).
		WithError(regularErr).
		Build()

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.NotNil(t, result.Error(), "Regular error should be stored as error")
	assert.Equal(t, regularErr, result.Error())
	assert.Nil(t, result.Warning(), "Regular error should not be stored as warning")
}

func TestJobResourceResult_WarningReason(t *testing.T) {
	t.Run("QuotaExceededError returns ReasonQuotaExceeded", func(t *testing.T) {
		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		result := NewResourceResult().WithError(quotaErr).Build()

		assert.Equal(t, provisioning.ReasonQuotaExceeded, result.WarningReason())
	})

	t.Run("wrapped QuotaExceededError returns ReasonQuotaExceeded", func(t *testing.T) {
		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		wrapped := fmt.Errorf("sync failed: %w", quotaErr)
		result := NewResourceResult().WithError(wrapped).Build()

		assert.Equal(t, provisioning.ReasonQuotaExceeded, result.WarningReason())
	})

	t.Run("ResourceValidationError returns ReasonResourceInvalid", func(t *testing.T) {
		validationErr := resources.NewResourceValidationError(errors.New("bad field"))
		result := NewResourceResult().WithError(validationErr).Build()

		assert.Equal(t, provisioning.ReasonResourceInvalid, result.WarningReason())
	})

	t.Run("ResourceOwnershipConflictError returns ReasonResourceInvalid", func(t *testing.T) {
		ownershipErr := resources.NewResourceOwnershipConflictError("res",
			utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "a"},
			utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "b"},
		)
		result := NewResourceResult().WithError(ownershipErr).Build()

		assert.Equal(t, provisioning.ReasonResourceInvalid, result.WarningReason())
	})

	t.Run("nil warning returns empty reason", func(t *testing.T) {
		result := NewResourceResult().Build()
		assert.Empty(t, result.WarningReason())
	})

	t.Run("regular error returns empty reason", func(t *testing.T) {
		result := NewResourceResult().WithError(errors.New("not a warning")).Build()
		assert.Empty(t, result.WarningReason())
	})

	t.Run("ResourceUnmanagedConflictError returns ReasonResourceInvalid", func(t *testing.T) {
		unmanagedErr := resources.NewResourceUnmanagedConflictError("res",
			utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "a"},
		)
		result := NewResourceResult().WithError(unmanagedErr).Build()

		assert.Equal(t, provisioning.ReasonResourceInvalid, result.WarningReason())
	})

	t.Run("wrapped ResourceUnmanagedConflictError returns ReasonResourceInvalid", func(t *testing.T) {
		unmanagedErr := resources.NewResourceUnmanagedConflictError("res",
			utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "a"},
		)
		wrapped := fmt.Errorf("writing resource: %w", unmanagedErr)
		result := NewResourceResult().WithError(wrapped).Build()

		assert.Equal(t, provisioning.ReasonResourceInvalid, result.WarningReason())
	})

	t.Run("explicit WithWarning with QuotaExceededError returns reason", func(t *testing.T) {
		quotaErr := quotas.NewQuotaExceededError(errors.New("over quota"))
		result := NewResourceResult().WithWarning(quotaErr).Build()

		assert.Equal(t, provisioning.ReasonQuotaExceeded, result.WarningReason())
	})

	t.Run("MissingFolderMetadata classifies as ReasonMissingFolderMetadata", func(t *testing.T) {
		missingErr := &resources.MissingFolderMetadata{Path: "somefolder/"}
		result := NewResourceResult().WithWarning(missingErr).Build()

		assert.Equal(t, provisioning.ReasonMissingFolderMetadata, result.WarningReason())
	})

	t.Run("FolderMetadataConflict classifies as ReasonFolderMetadataConflict", func(t *testing.T) {
		conflictErr := &resources.FolderMetadataConflict{Path: "somefolder/", Reason: "UID mismatch"}
		result := NewResourceResult().WithWarning(conflictErr).Build()

		assert.Equal(t, provisioning.ReasonFolderMetadataConflict, result.WarningReason())
	})

	t.Run("wrapped FolderMetadataConflict classifies as ReasonFolderMetadataConflict", func(t *testing.T) {
		conflictErr := &resources.FolderMetadataConflict{Path: "somefolder/", Reason: "UID mismatch"}
		wrapped := fmt.Errorf("processing folder: %w", conflictErr)
		result := NewResourceResult().WithError(wrapped).Build()

		assert.Equal(t, provisioning.ReasonFolderMetadataConflict, result.WarningReason())
	})
}

func TestIsNonFailingWarning(t *testing.T) {
	t.Run("nil is not a non-failing warning", func(t *testing.T) {
		assert.False(t, isNonFailingWarning(nil))
	})

	t.Run("MissingFolderMetadata is a non-failing warning", func(t *testing.T) {
		assert.True(t, isNonFailingWarning(resources.NewMissingFolderMetadata("folder/")))
	})

	t.Run("InvalidFolderMetadata is a non-failing warning", func(t *testing.T) {
		assert.True(t, isNonFailingWarning(resources.NewInvalidFolderMetadata("folder/", errors.New("bad json"))))
	})

	t.Run("FolderMetadataConflict is not a non-failing warning", func(t *testing.T) {
		assert.False(t, isNonFailingWarning(&resources.FolderMetadataConflict{Path: "folder/", Reason: "UID mismatch"}))
	})

	t.Run("ResourceValidationError is not a non-failing warning", func(t *testing.T) {
		assert.False(t, isNonFailingWarning(resources.NewResourceValidationError(errors.New("invalid"))))
	})

	t.Run("generic error is not a non-failing warning", func(t *testing.T) {
		assert.False(t, isNonFailingWarning(errors.New("something went wrong")))
	})
}

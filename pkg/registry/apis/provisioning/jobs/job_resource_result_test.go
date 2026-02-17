package jobs

import (
	"errors"
	"fmt"
	"testing"

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

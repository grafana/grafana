package jobs

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/assert"
)

func TestNewSkippedJobResourceResult(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	err := errors.New("skip reason")

	result := NewSkippedJobResourceResult(name, group, kind, path, err)

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

	result := NewJobResourceResult(name, group, kind, path, action, err)

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.NotNil(t, result.Error())
	assert.Equal(t, err, result.Error())
}

func TestNewJobResourceResult_WithoutError(t *testing.T) {
	name := "test-resource"
	group := "test-group"
	kind := "test-kind"
	path := "/test/path"
	action := repository.FileActionUpdated

	result := NewJobResourceResult(name, group, kind, path, action, nil)

	assert.Equal(t, name, result.Name())
	assert.Equal(t, group, result.Group())
	assert.Equal(t, kind, result.Kind())
	assert.Equal(t, path, result.Path())
	assert.Equal(t, action, result.Action())
	assert.Nil(t, result.Error())
}

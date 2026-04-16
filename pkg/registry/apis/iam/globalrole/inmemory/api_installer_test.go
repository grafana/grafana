package inmemory

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
)

func newTestInstaller() *InMemoryGlobalRoleApiInstaller {
	return &InMemoryGlobalRoleApiInstaller{
		logger: log.New("test"),
	}
}

func TestValidateOnCreateReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.ValidateOnCreate(context.Background(), &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestValidateOnUpdateReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.ValidateOnUpdate(context.Background(), &iamv0.GlobalRole{}, &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestValidateOnDeleteReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.ValidateOnDelete(context.Background(), &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestMutateOnCreateReturnsNil(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnCreate(context.Background(), &iamv0.GlobalRole{})
	assert.NoError(t, err)
}

func TestMutateOnUpdateReturnsNil(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnUpdate(context.Background(), &iamv0.GlobalRole{}, &iamv0.GlobalRole{})
	assert.NoError(t, err)
}

func TestMutateOnDeleteReturnsNil(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnDelete(context.Background(), &iamv0.GlobalRole{})
	assert.NoError(t, err)
}

func TestMutateOnConnectReturnsNil(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnConnect(context.Background(), &iamv0.GlobalRole{})
	assert.NoError(t, err)
}

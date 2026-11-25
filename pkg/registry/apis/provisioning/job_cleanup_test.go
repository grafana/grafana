package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobCleanupService_IsDisabled(t *testing.T) {
	assert.True(t, ProvideJobCleanupService(nil).IsDisabled())
	assert.True(t, ProvideJobCleanupService(&APIBuilder{onlyApiServer: true}).IsDisabled())
	assert.False(t, ProvideJobCleanupService(&APIBuilder{}).IsDisabled())
}

func TestJobCleanupService_StopsBeforeLoopbackConfig(t *testing.T) {
	s := ProvideJobCleanupService(&APIBuilder{loopbackReady: make(chan struct{})})
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	require.NoError(t, s.running(ctx))
}

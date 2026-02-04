package identity

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestWithProvisioningIdentity_Audience(t *testing.T) {
	ctx := context.Background()
	namespace := "default"
	
	ctx, requester, err := WithProvisioningIdentity(ctx, namespace)
	require.NoError(t, err)
	require.NotNil(t, requester)
	
	audience := requester.GetAudience()
	t.Logf("Audience: %v", audience)
	
	// Check that provisioning audience is set
	assert.Contains(t, audience, provisioning.GROUP, 
		"WithProvisioningIdentity should set audience to include provisioning.GROUP")
	
	// Verify it's the correct value
	assert.Equal(t, "provisioning.grafana.app", provisioning.GROUP)
}

func TestWithServiceIdentity_NoProvisioningAudience(t *testing.T) {
	ctx := context.Background()
	
	ctx, requester := WithServiceIdentity(ctx, 1)
	require.NotNil(t, requester)
	
	audience := requester.GetAudience()
	t.Logf("Audience: %v", audience)
	
	// Regular service identity should NOT have provisioning audience
	assert.NotContains(t, audience, provisioning.GROUP,
		"WithServiceIdentity should NOT set provisioning audience")
}

func TestWithProvisioningIdentity_UID(t *testing.T) {
	ctx := context.Background()
	namespace := "default"
	
	ctx, requester, err := WithProvisioningIdentity(ctx, namespace)
	require.NoError(t, err)
	require.NotNil(t, requester)
	
	uid := requester.GetUID()
	t.Logf("UID: %s", uid)
	
	// The UID should match what the managed.go check expects
	expectedUID := "access-policy:provisioning"
	t.Logf("Expected UID: %s", expectedUID)
	t.Logf("Match: %v", uid == expectedUID)
	
	audience := requester.GetAudience()
	t.Logf("Audience: %v", audience)
	t.Logf("Contains provisioning.GROUP: %v", slices.Contains(audience, provisioning.GROUP))
}

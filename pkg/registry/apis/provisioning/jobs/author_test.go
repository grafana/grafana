package jobs

import (
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestUserAttribution(t *testing.T) {
	tests := []struct {
		name      string
		requester identity.Requester
		flag      bool
		expected  *Author
	}{
		{
			name: "user identity returns signature",
			requester: &identity.StaticRequester{
				Type:    authlib.TypeUser,
				Name:    "Test User",
				Email:   "test@example.com",
				UserUID: "abc123",
			},
			flag:     true,
			expected: &Author{Name: "Test User", Email: "test@example.com", ID: "user:abc123"},
		},
		{
			name: "flag disabled returns nothing",
			requester: &identity.StaticRequester{
				Type:  authlib.TypeUser,
				Name:  "Test User",
				Email: "test@example.com",
			},
			flag:     false,
			expected: nil,
		},
		{
			name: "service identity returns nothing",
			requester: &identity.StaticRequester{
				Type: authlib.TypeAccessPolicy,
				Name: "provisioning",
			},
			flag:     true,
			expected: nil,
		},
		{
			name:      "missing requester returns nothing",
			requester: nil,
			flag:      true,
			expected:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := t.Context()
			if tt.requester != nil {
				ctx = identity.WithRequester(ctx, tt.requester)
			}
			setUserAttributionFlag(t, tt.flag)

			author, ok := UserAttribution(ctx)
			if tt.expected == nil {
				assert.False(t, ok)
			} else {
				require.True(t, ok)
				assert.Equal(t, *tt.expected, author)
			}
		})
	}
}

func setUserAttributionFlag(t *testing.T, value bool) {
	t.Helper()
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagProvisioningUserAttribution: {
			Key:      featuremgmt.FlagProvisioningUserAttribution,
			Variants: map[string]any{"": value},
		},
	})
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

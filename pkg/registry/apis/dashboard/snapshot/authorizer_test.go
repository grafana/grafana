package snapshot

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func setKubernetesSnapshotsToggle(t *testing.T, enabled bool) {
	t.Helper()
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagSnapshotsKubernetesSnapshots: {
			Key:            featuremgmt.FlagSnapshotsKubernetesSnapshots,
			DefaultVariant: variant,
			Variants: map[string]any{
				"enabled":  true,
				"disabled": false,
			},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

func snapshotAttributes(verb, subresource string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        dashV0.GROUP,
		APIVersion:      dashV0.VERSION,
		Resource:        dashV0.SnapshotResourceInfo.GetName(),
		Subresource:     subresource,
		Verb:            verb,
		Namespace:       "stacks-1",
	}
}

// The snapshots resource is gated per request in the authorizer: storage is always
// registered, so enablement is enforced here rather than at route-registration time.
func TestSnapshotAuthorizer_FeatureGate(t *testing.T) {
	ctx := context.Background()
	// accessControl is only reached after the feature gate; a disabled feature must
	// short-circuit before it, so nil is safe for the disabled cases.
	authz := NewSnapshotAuthorizer(nil)

	t.Run("denies every snapshot request when disabled", func(t *testing.T) {
		setKubernetesSnapshotsToggle(t, false)
		cases := []struct {
			verb, subresource string
		}{
			{"get", ""},
			{"get", "dashboard"},
			{"get", "deletekey"},
			{"list", ""},
			{"create", ""},
			{"delete", ""},
		}
		for _, tc := range cases {
			name := tc.verb
			if tc.subresource != "" {
				name = tc.verb + "-" + tc.subresource
			}
			t.Run(name, func(t *testing.T) {
				decision, reason, err := authz.Authorize(ctx, snapshotAttributes(tc.verb, tc.subresource))
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Equal(t, "kubernetes snapshots feature is not enabled", reason)
			})
		}
	})

	t.Run("falls through to the snapshot rules when enabled", func(t *testing.T) {
		setKubernetesSnapshotsToggle(t, true)
		// Anonymous GET on a snapshot is allowed for public viewing; reaching that
		// decision proves the request was not short-circuited by the feature gate.
		decision, _, err := authz.Authorize(ctx, snapshotAttributes("get", ""))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, decision)
	})
}

package acimpl

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type legacyRoutingContextProvider struct{ openfeature.NoopProvider }

func (legacyRoutingContextProvider) BooleanEvaluation(_ context.Context, flag string, fallback bool, ctx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	if flag != featuremgmt.FlagAuthzLegacyUserPermissions {
		return openfeature.BoolResolutionDetail{Value: fallback}
	}
	return openfeature.BoolResolutionDetail{Value: ctx[openfeature.TargetingKey] == "enabled"}
}

func TestIntegrationLegacyPermissionRoutingUsesTransactionContext(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	require.NoError(t, openfeature.SetProviderAndWait(legacyRoutingContextProvider{}))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	s := setupTestEnv(t, false)
	s.legacyClient = nil
	requester := &user.SignedInUser{UserID: 7, OrgID: 1}
	for _, target := range []string{"disabled", "enabled", "disabled"} {
		ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext(target, nil))
		permissions, err := s.GetUserPermissions(ctx, requester, ac.Options{})
		if target == "enabled" {
			require.ErrorContains(t, err, "embedded legacy AuthZ client is not configured")
			require.Empty(t, permissions)
		} else {
			require.NoError(t, err)
			require.ElementsMatch(t, []ac.Permission{SharedWithMeFolderPermission}, permissions)
		}
	}
}

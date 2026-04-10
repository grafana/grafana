package authorizer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/org"
)

type roleAttributes struct {
	authorizer.Attributes
	verb              string
	isResourceRequest bool
	apiGroup          string
}

func (a roleAttributes) GetVerb() string         { return a.verb }
func (a roleAttributes) IsResourceRequest() bool { return a.isResourceRequest }
func (a roleAttributes) GetAPIGroup() string     { return a.apiGroup }
func (a roleAttributes) GetResource() string     { return "" }
func (a roleAttributes) GetPath() string         { return "" }

func ctxWithRole(role org.RoleType) context.Context {
	return identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: role,
	})
}

func TestRoleAuthorizer_NoneRole_DiscoveryEndpoints(t *testing.T) {
	auth := roleAuthorizer{}

	t.Run("non-resource GET is allowed for RoleNone (api discovery)", func(t *testing.T) {
		attrs := &roleAttributes{verb: "get", isResourceRequest: false}
		decision, _, err := auth.Authorize(ctxWithRole(org.RoleNone), attrs)
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("non-resource POST is denied for RoleNone", func(t *testing.T) {
		attrs := &roleAttributes{verb: "post", isResourceRequest: false}
		decision, _, err := auth.Authorize(ctxWithRole(org.RoleNone), attrs)
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("resource request is denied for RoleNone", func(t *testing.T) {
		attrs := &roleAttributes{verb: "get", isResourceRequest: true}
		decision, _, err := auth.Authorize(ctxWithRole(org.RoleNone), attrs)
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("playlist API group grants viewer-like reads for RoleNone hotfix", func(t *testing.T) {
		for _, verb := range []string{"get", "list", "watch"} {
			attrs := &roleAttributes{
				verb:              verb,
				isResourceRequest: true,
				apiGroup:          "playlist.grafana.app",
			}
			decision, _, err := auth.Authorize(ctxWithRole(org.RoleNone), attrs)
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision, "verb=%s", verb)
		}
	})

	t.Run("playlist API group write is denied for RoleNone hotfix", func(t *testing.T) {
		attrs := &roleAttributes{
			verb:              "create",
			isResourceRequest: true,
			apiGroup:          "playlist.grafana.app",
		}
		decision, _, err := auth.Authorize(ctxWithRole(org.RoleNone), attrs)
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})
}

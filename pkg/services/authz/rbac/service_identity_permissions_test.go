package rbac

import (
	"fmt"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// TestServiceIdentityTokenPermissionsCoverMapper ensures that every (group, resource, verb)
// combination defined in the rbac mapper is also covered by the service identity's
// delegated permissions in pkg/apimachinery/identity/context.go.
//
// Why this matters: authlib.CheckServicePermissions runs *before* the user permission
// check on every authz call. For any caller that isn't a TypeAccessPolicy (i.e. real
// users and service accounts going through Grafana's normal auth flow), it evaluates the
// caller's DelegatedPermissions — which AccessClaimsHook hard-codes to
// identity.ServiceIdentityClaims.Rest.DelegatedPermissions whenever there's no upstream
// access token. If the service identity token doesn't cover an action the validator (or
// any other authzlib client) asks for, the request is denied before the user's RBAC
// permissions are even consulted.
func TestServiceIdentityTokenPermissionsCoverMapper(t *testing.T) {
	// Simulate the post-AccessClaimsHook state for a normal user/SA: identity is not
	// TypeAccessPolicy, so CheckServicePermissions reads DelegatedPermissions.
	caller := &identity.StaticRequester{
		Type: types.TypeUser,
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{
				DelegatedPermissions: identity.ServiceIdentityClaims.Rest.DelegatedPermissions,
			},
		},
	}

	// Sanity-check the test setup: a non-TypeAccessPolicy caller should be evaluated
	// against DelegatedPermissions, and the token must be non-empty.
	probe := authzlib.CheckServicePermissions(caller, "dashboard.grafana.app", "dashboards", utils.VerbGet)
	assert.False(t, probe.ServiceCall, "test caller must not be a service call so DelegatedPermissions are evaluated")
	assert.NotEmpty(t, probe.Permissions, "service identity delegated permissions must be populated")

	registry, ok := NewMapperRegistry().(mapper)
	if !ok {
		t.Fatal("NewMapperRegistry did not return the expected mapper type")
	}

	// Dedupe (group, apiResource, verb) triples: aliased mappings (e.g. iam.grafana.app
	// has both "globalroles" and "roles" pointing at apiResource="roles") would
	// otherwise produce duplicate subtests with the same assertion.
	type triple struct{ group, resource, verb string }
	checks := map[triple]struct{}{}

	for group, resources := range registry {
		// Wildcard groups (e.g. "*.datasource.grafana.app") are matched against
		// concrete groups at request time. The RolePermissionValidator explicitly
		// falls back to the legacy permission path for datasources, so the service
		// identity token is never consulted for these. They're covered separately
		// in the mapper's own wildcard tests.
		if strings.HasPrefix(group, "*.") {
			continue
		}

		for _, tr := range resources {
			// Use the API resource name (what the validator passes to authzlib),
			// not the internal RBAC resource name — e.g. provisioning.grafana.app
			// uses "jobs", not "provisioning.jobs".
			apiResource, ok := registry.GetAPIResourceName(group, tr.Resource())
			if !ok {
				continue
			}
			for verb := range tr.verbMapping {
				checks[triple{group, apiResource, verb}] = struct{}{}
			}
		}
	}

	// Sanity: the mapper should contribute a non-trivial number of triples; if it
	// drops to zero the iteration above is broken and the rest of the test would
	// silently pass.
	assert.GreaterOrEqual(t, len(checks), 50, "expected the mapper to yield many (group,resource,verb) triples")

	for c := range checks {
		t.Run(fmt.Sprintf("%s/%s:%s", c.group, c.resource, c.verb), func(t *testing.T) {
			res := authzlib.CheckServicePermissions(caller, c.group, c.resource, c.verb)
			assert.True(t, res.Allowed,
				"service identity must allow group=%q resource=%q verb=%q; "+
					"add %q (or a covering wildcard) to serviceIdentityTokenPermissions in "+
					"pkg/apimachinery/identity/context.go",
				c.group, c.resource, c.verb,
				fmt.Sprintf("%s/%s:*", c.group, c.resource),
			)
		})
	}
}

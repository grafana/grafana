package accesscontrol_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestResourceAuthorizer_Authorize(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())

	t.Run("should have no opinion for non resource requests", func(t *testing.T) {
		a := accesscontrol.NewResourceAuthorizer(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
		})

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{})
		decision, _, _ := a.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			Namespace:       "default",
			Resource:        "dashboards",
			ResourceRequest: false,
		})

		assert.Equal(t, authorizer.DecisionNoOpinion, decision)
	})

	t.Run("should just check action for list requests", func(t *testing.T) {
		a := accesscontrol.NewResourceAuthorizer(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping: map[string]string{
				"list": "dashboards:read",
			},
		})

		ctx := identity.WithRequester(context.Background(), newIdent(
			accesscontrol.Permission{Action: "dashboards:read"},
		))

		decision, _, _ := a.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "list",
			Namespace:       "default",
			Resource:        "dashboards",
			ResourceRequest: true,
		})

		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("should reject when user don't have correct scope", func(t *testing.T) {
		a := accesscontrol.NewResourceAuthorizer(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping: map[string]string{
				"get": "dashboards:read",
			},
		})

		ctx := identity.WithRequester(context.Background(), newIdent(
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:2"},
		))

		decision, _, _ := a.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			Namespace:       "default",
			Resource:        "dashboards",
			Name:            "1",
			ResourceRequest: true,
		})

		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("should allow when user have correct scope", func(t *testing.T) {
		a := accesscontrol.NewResourceAuthorizer(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping: map[string]string{
				"get": "dashboards:read",
			},
		})

		ctx := identity.WithRequester(context.Background(), newIdent(
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:1"},
		))

		decision, _, _ := a.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			Namespace:       "default",
			Resource:        "dashboards",
			Name:            "1",
			ResourceRequest: true,
		})

		assert.Equal(t, authorizer.DecisionAllow, decision)
	})
}

func newIdent(permissions ...accesscontrol.Permission) *identity.StaticRequester {
	pmap := map[string][]string{}
	for _, p := range permissions {
		pmap[p.Action] = append(pmap[p.Action], p.Scope)
	}

	return &identity.StaticRequester{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: pmap},
	}
}

package accesscontrol_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestLegacyAccessClient_HasAccess(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())

	t.Run("should reject when when no configuration for resource exist", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac)

		ok, err := a.HasAccess(context.Background(), &identity.StaticRequester{}, claims.AccessRequest{
			Verb:      "get",
			Resource:  "dashboards",
			Namespace: "default",
			Name:      "1",
		})
		assert.NoError(t, err)
		assert.Equal(t, false, ok)
	})

	t.Run("should reject when user don't have correct scope", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping: map[string]string{
				"get": "dashboards:read",
			},
		})

		ident := newIdent(
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:2"},
		)

		ok, err := a.HasAccess(context.Background(), ident, claims.AccessRequest{
			Verb:      "get",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, false, ok)
	})

	t.Run("should just check action for list requests", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping: map[string]string{
				"list": "dashboards:read",
			},
		})

		ident := newIdent(
			accesscontrol.Permission{Action: "dashboards:read"},
		)

		ok, err := a.HasAccess(context.Background(), ident, claims.AccessRequest{
			Verb:      "list",
			Namespace: "default",
			Resource:  "dashboards",
		})

		assert.NoError(t, err)
		assert.Equal(t, true, ok)
	})

	t.Run("should allow when user have correct scope", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping: map[string]string{
				"get": "dashboards:read",
			},
		})

		ident := newIdent(
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:1"},
		)

		ok, err := a.HasAccess(context.Background(), ident, claims.AccessRequest{
			Verb:      "get",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, true, ok)
	})

	t.Run("should skip authorization for configured verb", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Unchecked: map[string]bool{
				"get": true,
			},
			Mapping: map[string]string{
				"create": "dashboards:create",
			},
		})

		ident := newIdent(accesscontrol.Permission{})

		ok, err := a.HasAccess(context.Background(), ident, claims.AccessRequest{
			Verb:      "get",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, true, ok)

		ok, err = a.HasAccess(context.Background(), ident, claims.AccessRequest{
			Verb:      "create",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, false, ok)
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

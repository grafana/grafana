package accesscontrol_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestLegacyAccessClient_Check(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	t.Run("should reject when when no configuration for resource exist", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac)

		res, err := a.Check(context.Background(), &identity.StaticRequester{}, authlib.CheckRequest{
			Verb:      "get",
			Resource:  "dashboards",
			Namespace: "default",
			Name:      "1",
		})
		assert.NoError(t, err)
		assert.Equal(t, false, res.Allowed)
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

		res, err := a.Check(context.Background(), ident, authlib.CheckRequest{
			Verb:      "get",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, false, res.Allowed)
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

		res, err := a.Check(context.Background(), ident, authlib.CheckRequest{
			Verb:      "list",
			Namespace: "default",
			Resource:  "dashboards",
		})

		assert.NoError(t, err)
		assert.Equal(t, true, res.Allowed)
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

		res, err := a.Check(context.Background(), ident, authlib.CheckRequest{
			Verb:      "get",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, true, res.Allowed)
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

		res, err := a.Check(context.Background(), ident, authlib.CheckRequest{
			Verb:      "get",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, true, res.Allowed)

		res, err = a.Check(context.Background(), ident, authlib.CheckRequest{
			Verb:      "create",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		})

		assert.NoError(t, err)
		assert.Equal(t, false, res.Allowed)
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

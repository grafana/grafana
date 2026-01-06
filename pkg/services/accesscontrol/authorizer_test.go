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
		}, "")
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
		}, "")

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
		}, "")

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
		}, "")

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
		}, "")

		assert.NoError(t, err)
		assert.Equal(t, true, res.Allowed)

		res, err = a.Check(context.Background(), ident, authlib.CheckRequest{
			Verb:      "create",
			Namespace: "default",
			Resource:  "dashboards",
			Name:      "1",
		}, "")

		assert.NoError(t, err)
		assert.Equal(t, false, res.Allowed)
	})
}

func TestLegacyAccessClient_BatchCheck(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	t.Run("should return empty results for empty checks", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac)

		res, err := a.BatchCheck(context.Background(), &identity.StaticRequester{}, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{},
		})

		assert.NoError(t, err)
		assert.Empty(t, res.Results)
	})

	t.Run("should reject unknown resource for non-admin", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac)

		res, err := a.BatchCheck(context.Background(), &identity.StaticRequester{}, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "unknown", Name: "1"},
			},
		})

		assert.NoError(t, err)
		assert.False(t, res.Results["check-1"].Allowed)
	})

	t.Run("should allow unknown resource for grafana admin", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac)

		res, err := a.BatchCheck(context.Background(), &identity.StaticRequester{IsGrafanaAdmin: true}, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "unknown", Name: "1"},
			},
		})

		assert.NoError(t, err)
		assert.True(t, res.Results["check-1"].Allowed)
	})

	t.Run("should allow unchecked verbs", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource:  "dashboards",
			Attr:      "uid",
			Unchecked: map[string]bool{"get": true},
		})

		res, err := a.BatchCheck(context.Background(), &identity.StaticRequester{}, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "dashboards", Name: "1"},
			},
		})

		assert.NoError(t, err)
		assert.True(t, res.Results["check-1"].Allowed)
	})

	t.Run("should return error for missing action mapping", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{}, // Empty mapping
		})

		res, err := a.BatchCheck(context.Background(), &identity.StaticRequester{}, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "dashboards", Name: "1"},
			},
		})

		assert.NoError(t, err)
		assert.False(t, res.Results["check-1"].Allowed)
		assert.Error(t, res.Results["check-1"].Error)
	})

	t.Run("should allow when user has correct scope", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{"get": "dashboards:read"},
		})

		ident := newIdent(accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:1"})

		res, err := a.BatchCheck(context.Background(), ident, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "dashboards", Name: "1"},
			},
		})

		assert.NoError(t, err)
		assert.True(t, res.Results["check-1"].Allowed)
	})

	t.Run("should reject when user has wrong scope", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{"get": "dashboards:read"},
		})

		ident := newIdent(accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:2"})

		res, err := a.BatchCheck(context.Background(), ident, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "dashboards", Name: "1"},
			},
		})

		assert.NoError(t, err)
		assert.False(t, res.Results["check-1"].Allowed)
	})

	t.Run("should handle list without name", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{"list": "dashboards:read"},
		})

		ident := newIdent(accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:*"})

		res, err := a.BatchCheck(context.Background(), ident, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "list", Resource: "dashboards", Name: ""},
			},
		})

		assert.NoError(t, err)
		assert.True(t, res.Results["check-1"].Allowed)
	})

	t.Run("should handle multiple checks with mixed results", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{"get": "dashboards:read"},
		})

		ident := newIdent(
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:1"},
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:3"},
		)

		res, err := a.BatchCheck(context.Background(), ident, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "dashboards", Name: "1"},
				{CorrelationID: "check-2", Verb: "get", Resource: "dashboards", Name: "2"},
				{CorrelationID: "check-3", Verb: "get", Resource: "dashboards", Name: "3"},
			},
		})

		assert.NoError(t, err)
		assert.True(t, res.Results["check-1"].Allowed)
		assert.False(t, res.Results["check-2"].Allowed)
		assert.True(t, res.Results["check-3"].Allowed)
	})

	t.Run("should use resolver when provided", func(t *testing.T) {
		resolver := accesscontrol.ResourceResolverFunc(func(ctx context.Context, ns authlib.NamespaceInfo, name string) ([]string, error) {
			// Resolve dashboard name to folder scope
			return []string{"folders:uid:folder-a"}, nil
		})

		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{"get": "dashboards:read"},
			Resolver: resolver,
		})

		ident := newIdent(accesscontrol.Permission{Action: "dashboards:read", Scope: "folders:uid:folder-a"})

		res, err := a.BatchCheck(context.Background(), ident, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check-1", Verb: "get", Resource: "dashboards", Name: "1", Namespace: "default"},
			},
		})

		assert.NoError(t, err)
		assert.True(t, res.Results["check-1"].Allowed)
	})

	t.Run("should cache checker by action", func(t *testing.T) {
		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "dashboards",
			Attr:     "uid",
			Mapping:  map[string]string{"get": "dashboards:read", "update": "dashboards:write"},
		})

		ident := newIdent(
			accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:*"},
			accesscontrol.Permission{Action: "dashboards:write", Scope: "dashboards:uid:1"},
		)

		res, err := a.BatchCheck(context.Background(), ident, authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "read-1", Verb: "get", Resource: "dashboards", Name: "1"},
				{CorrelationID: "read-2", Verb: "get", Resource: "dashboards", Name: "2"},
				{CorrelationID: "write-1", Verb: "update", Resource: "dashboards", Name: "1"},
				{CorrelationID: "write-2", Verb: "update", Resource: "dashboards", Name: "2"},
			},
		})

		assert.NoError(t, err)
		// Read with wildcard scope should allow all
		assert.True(t, res.Results["read-1"].Allowed)
		assert.True(t, res.Results["read-2"].Allowed)
		// Write only has scope for uid:1
		assert.True(t, res.Results["write-1"].Allowed)
		assert.False(t, res.Results["write-2"].Allowed)
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

package common

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type item struct {
	id string
}

func (i item) AuthID() string {
	return i.id
}

func TestList(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	t.Run("should allow all items if no access client is passed", func(t *testing.T) {
		ctx := newContext("stacks-1", newIdent())

		res, err := List(ctx, utils.NewResourceInfo("", "", "items", "", "", nil, nil, utils.TableColumns{}), nil, Pagination{Limit: 2}, func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[item], error) {
			return &ListResponse[item]{
				Items: []item{{"1"}, {"2"}},
			}, nil
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 2)
	})

	t.Run("should filter out items that are allowed", func(t *testing.T) {
		ctx := newContext("stacks-1", newIdent(accesscontrol.Permission{Action: "items:read", Scope: "items:uid:1"}))

		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "items",
			Attr:     "uid",
		})
		res, err := List(ctx, utils.NewResourceInfo("", "", "items", "", "", nil, nil, utils.TableColumns{}), a, Pagination{Limit: 2}, func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[item], error) {
			return &ListResponse[item]{
				Items: []item{{"1"}, {"2"}},
			}, nil
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 1)
	})

	t.Run("should fetch more for partial response with continue token", func(t *testing.T) {
		ctx := newContext("stacks-1", newIdent(
			accesscontrol.Permission{Action: "items:read", Scope: "items:uid:1"},
			accesscontrol.Permission{Action: "items:read", Scope: "items:uid:3"},
		))

		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "items",
			Attr:     "uid",
		})

		var called bool

		res, err := List(ctx, utils.NewResourceInfo("", "", "items", "", "", nil, nil, utils.TableColumns{}), a, Pagination{Limit: 2}, func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[item], error) {
			if called {
				return &ListResponse[item]{
					Items: []item{{"3"}},
				}, nil
			}

			called = true
			return &ListResponse[item]{
				Items:    []item{{"1"}, {"2"}},
				Continue: 3,
			}, nil
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 2)

		assert.Equal(t, "1", res.Items[0].AuthID())
		assert.Equal(t, "3", res.Items[1].AuthID())
	})
}

func newContext(namespace string, ident *identity.StaticRequester) context.Context {
	return request.WithNamespace(identity.WithRequester(context.Background(), ident), namespace)
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

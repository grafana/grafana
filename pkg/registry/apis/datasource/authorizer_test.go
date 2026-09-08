package datasource

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/user"
)

type recordingAccessClient struct {
	lastReq authlib.CheckRequest
	resp    authlib.CheckResponse
	err     error
}

func (r *recordingAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	r.lastReq = req
	return r.resp, r.err
}

func (r *recordingAccessClient) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (r *recordingAccessClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func newAuthorizerTestBuilder(client authlib.AccessClient) *DataSourceAPIBuilder {
	return &DataSourceAPIBuilder{
		datasourceResourceInfo: datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("test.datasource.grafana.app", "test"),
		pluginJSON:             plugins.JSONData{ID: "test"},
		accessClient:           client,
	}
}

func authorizerTestContext() context.Context {
	return identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1, Login: "admin"})
}

// installedSubresources is every subresource UpdateAPIGroupInfo can install:
// "query" unconditionally, "resources" and "health" behind their feature
// flags, "access" whenever the dual writer is on (the same flag that enables
// the CRUD API), and "proxy" for any plugin declaring routes. The authorizer
// must gate all of them, so both subresource tests iterate this list.
var installedSubresources = []string{"query", "resources", "health", "access", "proxy"}

// TestGetAuthorizer_CRUDVerbsPassThrough proves that CRUD requests (empty
// subresource) are authorized against the "datasources" resource using the
// caller's original k8s verb, not the "query" subresource used for /query
// subresource requests. The verb-to-legacy-action translation happens
// downstream in the RBAC mapper.
func TestGetAuthorizer_CRUDVerbsPassThrough(t *testing.T) {
	crudVerbs := []string{"get", "list", "create", "update", "patch", "delete", "deletecollection"}

	for _, verb := range crudVerbs {
		t.Run(verb, func(t *testing.T) {
			client := &recordingAccessClient{resp: authlib.CheckResponse{Allowed: true}}
			b := newAuthorizerTestBuilder(client)

			decision, _, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            verb,
				Namespace:       "default",
				Name:            "some-uid",
			})

			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision)

			require.Equal(t, verb, client.lastReq.Verb, "the raw verb should be forwarded for CRUD requests")
			require.Equal(t, "datasources", client.lastReq.Resource)
			require.Equal(t, "test.datasource.grafana.app", client.lastReq.Group)
			require.Equal(t, "some-uid", client.lastReq.Name)
			require.Empty(t, client.lastReq.Subresource)
		})
	}
}

// TestGetAuthorizer_CollectionVerbsCarryNoName covers the shape the apiserver
// actually sends for collection requests: list and create have no name. The
// empty name is forwarded as-is, which downstream turns into a coarse
// "holds the action on any datasource" check rather than a scoped one, so the
// per-item filtering in the datasource service is what narrows list results.
func TestGetAuthorizer_CollectionVerbsCarryNoName(t *testing.T) {
	for _, verb := range []string{"list", "create", "deletecollection"} {
		t.Run(verb, func(t *testing.T) {
			client := &recordingAccessClient{resp: authlib.CheckResponse{Allowed: true}}
			b := newAuthorizerTestBuilder(client)

			decision, _, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            verb,
				Namespace:       "default",
			})

			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision)

			require.Equal(t, verb, client.lastReq.Verb)
			require.Equal(t, "datasources", client.lastReq.Resource)
			require.Empty(t, client.lastReq.Name, "collection requests must not invent a name")
			require.Empty(t, client.lastReq.Subresource)
		})
	}
}

func TestGetAuthorizer_CRUDVerbDenied(t *testing.T) {
	client := &recordingAccessClient{resp: authlib.CheckResponse{Allowed: false}}
	b := newAuthorizerTestBuilder(client)

	decision, reason, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "delete",
		Namespace:       "default",
		Name:            "some-uid",
	})

	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access denied", reason)
	require.Equal(t, "delete", client.lastReq.Verb)
}

// TestGetAuthorizer_SubresourceForcesQueryCheck proves that every installed
// subresource is authorized as a "query" subresource create, regardless of the
// actual k8s verb or subresource name.
func TestGetAuthorizer_SubresourceForcesQueryCheck(t *testing.T) {
	for _, sub := range installedSubresources {
		t.Run(sub, func(t *testing.T) {
			client := &recordingAccessClient{resp: authlib.CheckResponse{Allowed: true}}
			b := newAuthorizerTestBuilder(client)

			decision, _, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "get",
				Subresource:     sub,
				Namespace:       "default",
				Name:            "some-uid",
			})

			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision)
			require.Equal(t, utils.VerbCreate, client.lastReq.Verb)
			require.Equal(t, "query", client.lastReq.Subresource)
			require.Equal(t, "datasources", client.lastReq.Resource)
		})
	}
}

func TestGetAuthorizer_SubresourceDenied(t *testing.T) {
	for _, sub := range installedSubresources {
		t.Run(sub, func(t *testing.T) {
			client := &recordingAccessClient{resp: authlib.CheckResponse{Allowed: false}}
			b := newAuthorizerTestBuilder(client)

			decision, reason, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "get",
				Subresource:     sub,
				Namespace:       "default",
				Name:            "some-uid",
			})

			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision)
			require.Equal(t, "missing `query` subresource permission", reason)
		})
	}
}

// TestGetAuthorizer_UnknownSubresourceInheritsQueryCheck pins the permissive
// default: a subresource the authorizer has never heard of is gated by
// `datasources:query` rather than denied. Any new subresource therefore starts
// out reachable by every caller holding query permission, so one exposing
// sensitive data or mutating state needs its own branch here before shipping.
func TestGetAuthorizer_UnknownSubresourceInheritsQueryCheck(t *testing.T) {
	client := &recordingAccessClient{resp: authlib.CheckResponse{Allowed: true}}
	b := newAuthorizerTestBuilder(client)

	decision, _, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "update",
		Subresource:     "permissions",
		Namespace:       "default",
		Name:            "some-uid",
	})

	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
	require.Equal(t, utils.VerbCreate, client.lastReq.Verb)
	require.Equal(t, "query", client.lastReq.Subresource,
		"unknown subresources collapse to the query check instead of failing closed")
}

func TestGetAuthorizer_NonResourceRequest(t *testing.T) {
	client := &recordingAccessClient{}
	b := newAuthorizerTestBuilder(client)

	decision, _, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
		ResourceRequest: false,
	})

	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionNoOpinion, decision)
}

func TestGetAuthorizer_NoUser(t *testing.T) {
	client := &recordingAccessClient{}
	b := newAuthorizerTestBuilder(client)

	decision, _, err := b.GetAuthorizer().Authorize(context.Background(), authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "get",
	})

	require.Error(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
}

func TestGetAuthorizer_CheckError(t *testing.T) {
	client := &recordingAccessClient{err: errors.New("boom")}
	b := newAuthorizerTestBuilder(client)

	decision, reason, err := b.GetAuthorizer().Authorize(authorizerTestContext(), authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "get",
	})

	require.Error(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "failed to check permissions", reason)
}

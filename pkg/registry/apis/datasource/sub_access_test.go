package datasource

import (
	"context"
	"errors"
	"strings"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type datasourceAccessTestClient struct {
	authlib.AccessClient
	batchCheck func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (c datasourceAccessTestClient) BatchCheck(ctx context.Context, user authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return c.batchCheck(ctx, user, req)
}

func TestDatasourceAccessReportsIndependentDecisions(t *testing.T) {
	for _, group := range []string{datasourceV0alpha1.GROUP, "test.datasource.grafana.app"} {
		t.Run(group, func(t *testing.T) {
			mapper := rbac.NewMapperRegistry()
			ctx := request.WithNamespace(authorizerTestContext(), "stacks-1")
			requester, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			const uid = "shared-id"

			probed := map[string]int{}
			seenSubresources := map[string]bool{}
			calls := 0
			client := datasourceAccessTestClient{batchCheck: func(_ context.Context, user authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				calls++
				require.Same(t, requester, user)
				require.Equal(t, "stacks-1", req.Namespace)
				require.NotEmpty(t, req.Checks)
				results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
				for _, check := range req.Checks {
					require.Equal(t, group, check.Group)
					require.Equal(t, "datasources", check.Resource)
					seenSubresources[check.Subresource] = true
					require.Equal(t, uid, check.Name)
					mapping, ok := mapper.Get(check.Group, check.Resource, check.Subresource)
					require.True(t, ok)
					action, ok := mapping.Action(check.Verb)
					require.True(t, ok)
					require.False(t, mapping.SkipScope(check.Verb))
					require.Equal(t, "datasources:uid:"+uid, mapping.Scope(check.Name))
					probed[action]++

					// The backend grants read across the namespace and grants only individual
					// capabilities on this UID, including permission write without permission read.
					allowed := action == "datasources:read" || uid == check.Name && (action == "datasources.permissions:write" ||
						action == "datasources.caching:read" || action == "alert.rules.external:write")
					results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: allowed}
				}
				return authlib.BatchCheckResponse{Results: results}, nil
			}}
			builder := newAuthorizerTestBuilder(client)
			builder.datasourceResourceInfo = datasourceV0alpha1.DataSourceResourceInfo.WithGroupAndShortName(group, "test")
			endpoint := &subAccessREST{builder: builder}

			access, err := endpoint.getAccessInfo(ctx, uid)
			require.NoError(t, err)
			require.Equal(t, 1, calls, "all datasource access checks should use one batch")
			require.Equal(t, map[string]bool{"": true, "query": true, "caching": true, "alertrules": true, "alertinstances": true, "alertnotifications": true}, seenSubresources)
			require.Equal(t, accesscontrol.Metadata{
				"datasources:read":              true,
				datasources.ActionIDRead:        true,
				"datasources.permissions:write": true,
				"datasources.caching:read":      true,
				"alert.rules.external:write":    true,
			}, access.Permissions)

			expected := map[string]int{}
			for _, mapping := range mapper.ResourceMappings(datasourceV0alpha1.GROUP) {
				resource, _, _ := strings.Cut(mapping.APIResource, "/")
				if resource != "datasources" {
					continue
				}
				for _, action := range mapping.Mapping.AllActions() {
					if action != "datasources:create" {
						expected[action] = 1
					}
				}
			}
			require.Equal(t, expected, probed)
			require.Equal(t, 1, probed[datasources.ActionRead], "read and ID-read should share one authorization check")
			require.NotContains(t, probed, datasources.ActionIDRead, "ID-read is reported from the read decision")
		})
	}
}

func TestDatasourceAccessFailsOnAuthorizationErrors(t *testing.T) {
	failure := errors.New("authorization unavailable")
	for _, tc := range []struct {
		name     string
		response func(authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
		want     string
	}{
		{
			name: "request error",
			response: func(authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				return authlib.BatchCheckResponse{}, failure
			},
			want: failure.Error(),
		},
		{
			name: "per-item error",
			response: func(req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				resp := authlib.BatchCheckResponse{Results: make(map[string]authlib.BatchCheckResult)}
				for _, item := range req.Checks {
					resp.Results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: true}
				}
				resp.Results[req.Checks[len(req.Checks)-1].CorrelationID] = authlib.BatchCheckResult{Error: failure}
				return resp, nil
			},
			want: failure.Error(),
		},
		{
			name: "missing item",
			response: func(authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				return authlib.BatchCheckResponse{}, nil
			},
			want: "missing authorization result for datasources:read",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := datasourceAccessTestClient{batchCheck: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				return tc.response(req)
			}}
			endpoint := &subAccessREST{builder: newAuthorizerTestBuilder(client)}
			access, err := endpoint.getAccessInfo(request.WithNamespace(authorizerTestContext(), "stacks-1"), "example")
			require.ErrorContains(t, err, tc.want)
			require.Nil(t, access)
		})
	}
}

func TestDatasourceAccessReportsNoPermissionOnDeny(t *testing.T) {
	endpoint := &subAccessREST{builder: newAuthorizerTestBuilder(authlib.FixedAccessClient(false))}
	access, err := endpoint.getAccessInfo(request.WithNamespace(authorizerTestContext(), "default"), "example")
	require.NoError(t, err)
	require.Nil(t, access.Permissions)
}

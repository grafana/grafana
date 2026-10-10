package server

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

type datasourceTokenServer struct {
	*Server
	calls int
	group string
}

func (s *datasourceTokenServer) Check(_ context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	s.calls++
	s.group = req.Group
	return s.Server.Check(newContextWithNamespace(), req)
}

func TestIntegrationDatasourceTokenBoundary(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	srv := &datasourceTokenServer{Server: setup(t, setupOpenFGAServer(t))}
	channel := &inprocgrpc.Channel{}
	authzv1.RegisterAuthzServiceServer(channel, srv)
	for _, tc := range []struct {
		name, grant, group, uid string
		direct, allowed         bool
		calls                   int
	}{
		{"concrete token and shared user grant", "loki.datasource.grafana.app", "loki.datasource.grafana.app", "ds-1", false, true, 1},
		{"concrete token cannot call another API", "loki.datasource.grafana.app", "prometheus.datasource.grafana.app", "ds-1", false, false, 0},
		{"wildcard token retains access", "*.datasource.grafana.app", "loki.datasource.grafana.app", "ds-1", false, true, 1},
		{"token cannot bypass UID grant", "*.datasource.grafana.app", "loki.datasource.grafana.app", "ds-2", false, false, 1},
		{"wildcard token does not include shared API", "*.datasource.grafana.app", "datasource.grafana.app", "ds-1", false, false, 0},
		{"direct service checks only its token", "loki.datasource.grafana.app", "loki.datasource.grafana.app", "ds-2", true, true, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			grant := tc.grant + "/datasources:create"
			access := authn.Claims[authn.AccessTokenClaims]{
				Claims: jwt.Claims{Subject: "service:test"},
				Rest:   authn.AccessTokenClaims{Namespace: namespace, Permissions: []string{grant}, DelegatedPermissions: []string{grant}},
			}
			var id types.AuthInfo = authn.NewAccessTokenAuthInfo(access)
			if !tc.direct {
				id = authn.NewIDTokenAuthInfo(access, &authn.Claims[authn.IDTokenClaims]{
					Claims: jwt.Claims{Subject: "user:u1"}, Rest: authn.IDTokenClaims{Namespace: namespace, Identifier: "u1", Type: types.TypeUser},
				})
			}
			srv.calls = 0
			client := authz.NewClient(channel)
			res, err := client.Check(context.Background(), id, types.CheckRequest{
				Namespace: namespace, Group: tc.group, Resource: "datasources", Subresource: "query", Verb: "create", Name: tc.uid,
			}, "")
			require.NoError(t, err)
			require.Equal(t, tc.allowed, res.Allowed)
			require.Equal(t, tc.calls, srv.calls)
			if tc.calls > 0 {
				require.Equal(t, tc.group, srv.group)
			}
		})
	}
}

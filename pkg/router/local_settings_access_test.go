package router

import (
	"context"
	"errors"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type settingsAuthzServer struct {
	authzv1.UnimplementedAuthzServiceServer
	requests []*authzv1.CheckRequest
	allowed  bool
}

func (s *settingsAuthzServer) Check(_ context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	s.requests = append(s.requests, req)
	return &authzv1.CheckResponse{Allowed: s.allowed}, nil
}

func TestLocalSettingsAccessCheckerWithAuthlib(t *testing.T) {
	for _, namespace := range []string{"default", "org-2", "stacks-1"} {
		for _, kind := range []types.IdentityType{types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous} {
			t.Run(namespace+"/"+string(kind), func(t *testing.T) {
				server := &settingsAuthzServer{allowed: true}
				channel := &inprocgrpc.Channel{}
				authzv1.RegisterAuthzServiceServer(channel, server)
				legacy := &localSettingsLegacyAccess{}
				user := settingsRequester(namespace)
				user.Type = kind
				ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{Namespace: namespace, Verb: "get", IsResourceRequest: true})
				decision, _, err := localSettingsAccessChecker(authzlib.NewClient(channel), legacy)(ctx, user, "example-app")
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionAllow, decision)
				require.Zero(t, legacy.calls)
				require.Len(t, server.requests, 1)
				require.Equal(t, namespace, server.requests[0].Namespace)
				require.Equal(t, user.GetUID(), server.requests[0].Subject)
			})
		}
	}
}

type localSettingsLegacyAccess struct {
	accesscontrol.AccessControl
	calls int
}

func (a *localSettingsLegacyAccess) Evaluate(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
	a.calls++
	return true, nil
}

func TestLocalSettingsAccessChecker(t *testing.T) {
	for _, tc := range []struct {
		name                                    string
		kind                                    types.IdentityType
		namespace                               string
		admin, discovery, allowed, fail, legacy bool
	}{
		{name: "user", kind: types.TypeUser, namespace: "default", allowed: true},
		{name: "service account", kind: types.TypeServiceAccount, namespace: "org-2", allowed: true},
		{name: "anonymous", kind: types.TypeAnonymous, namespace: "default", allowed: true},
		{name: "admin", kind: types.TypeUser, namespace: "default", admin: true, allowed: true},
		{name: "denial does not fall back", kind: types.TypeUser, namespace: "default"},
		{name: "outage does not fall back", kind: types.TypeUser, namespace: "default", fail: true},
		{name: "discovery", kind: types.TypeUser, namespace: "default", discovery: true, allowed: true},
		{name: "API key compatibility", kind: types.TypeAPIKey, namespace: "default", legacy: true},
		{name: "cross namespace admin compatibility", kind: types.TypeUser, namespace: "org-2", admin: true, legacy: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			legacy := &localSettingsLegacyAccess{}
			calls := 0
			client := newSettingsAccessClient(func(_ types.AuthInfo, req types.CheckRequest) (bool, error) {
				calls++
				require.Equal(t, tc.namespace, req.Namespace)
				if tc.fail {
					return false, errors.New("unavailable")
				}
				return tc.allowed, nil
			})
			user := settingsRequester(tc.namespace)
			user.Type, user.IsGrafanaAdmin = tc.kind, tc.admin
			if tc.legacy && tc.admin {
				user.Namespace = "default"
			}
			ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{Namespace: tc.namespace, Verb: "get", IsResourceRequest: !tc.discovery})
			decision, _, err := localSettingsAccessChecker(client, legacy)(ctx, user, "example-app")
			if tc.fail {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			if tc.allowed || tc.legacy {
				require.Equal(t, authorizer.DecisionAllow, decision)
			} else {
				require.Equal(t, authorizer.DecisionDeny, decision)
			}
			if tc.legacy {
				require.Equal(t, 1, legacy.calls)
				require.Zero(t, calls)
			} else {
				require.Zero(t, legacy.calls)
				require.Equal(t, 1, calls)
			}
		})
	}
}

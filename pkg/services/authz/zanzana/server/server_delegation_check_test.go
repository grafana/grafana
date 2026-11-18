package server

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationServerCheckWildcardFolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)

	for _, tc := range []struct {
		name     string
		subject  string
		folder   string
		resource string
		allowed  bool
	}{
		{name: "specific folder grant", subject: "user:4", folder: "1", resource: dashboardResource, allowed: true},
		{name: "specific folder grant does not cover every folder", subject: "user:4", folder: "*", resource: dashboardResource},
		{name: "group resource grant covers every folder", subject: "user:2", folder: "*", resource: dashboardResource, allowed: true},
		{name: "unsupported resource in every folder", subject: "user:4", folder: "*", resource: "variables"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requireCheckAndBatchDecision(t, server, &authzv1.CheckRequest{
				Namespace: namespace,
				Subject:   tc.subject,
				Verb:      utils.VerbGet,
				Group:     dashboardGroup,
				Resource:  tc.resource,
				Name:      "*",
				Folder:    tc.folder,
			}, tc.allowed)
		})
	}
}

func requireCheckAndBatchDecision(t *testing.T, server *Server, req *authzv1.CheckRequest, allowed bool) {
	t.Helper()
	t.Run("Check", func(t *testing.T) {
		res, err := server.Check(newContextWithNamespace(), req)
		require.NoError(t, err)
		require.Equal(t, allowed, res.GetAllowed())
	})
	t.Run("BatchCheck", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
			Namespace: req.GetNamespace(),
			Subject:   req.GetSubject(),
			Checks: []*authzv1.BatchCheckItem{{
				CorrelationId: "delegation",
				Verb:          req.GetVerb(),
				Group:         req.GetGroup(),
				Resource:      req.GetResource(),
				Subresource:   req.GetSubresource(),
				Name:          req.GetName(),
				Folder:        req.GetFolder(),
			}},
		})
		require.NoError(t, err)
		require.Contains(t, res.GetResults(), "delegation")
		result := res.GetResults()["delegation"]
		require.Empty(t, result.GetError())
		require.Equal(t, allowed, result.GetAllowed())
	})
}

func TestIntegrationServerCheckUnsupportedPermissionDelegation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)

	for _, action := range []string{
		"roles:write", "roles:delete",
		"users.roles:add", "users.roles:remove",
		"teams.roles:add", "teams.roles:remove",
	} {
		t.Run(action, func(t *testing.T) {
			requireCheckAndBatchDecision(t, server, &authzv1.CheckRequest{
				Namespace:   namespace,
				Subject:     "user:2",
				Verb:        utils.VerbPatch,
				Group:       "iam.grafana.app",
				Resource:    "permissions",
				Subresource: action,
				Name:        "delegate",
			}, false)
		})
	}
}

package authorizer

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/org"
)

// Uses the apiserver's own parser, so the assumptions below are pinned to real
// behaviour rather than a guess.
func attributesFor(t *testing.T, method, path string) authorizer.AttributesRecord {
	t.Helper()
	f := &request.RequestInfoFactory{
		APIPrefixes:          sets.NewString("apis"),
		GrouplessAPIPrefixes: sets.NewString(),
	}
	r, err := http.NewRequest(method, path, nil)
	require.NoError(t, err)
	info, err := f.NewRequestInfo(r)
	require.NoError(t, err)

	return authorizer.AttributesRecord{
		Verb:            info.Verb,
		Namespace:       info.Namespace,
		APIGroup:        info.APIGroup,
		APIVersion:      info.APIVersion,
		Resource:        info.Resource,
		Subresource:     info.Subresource,
		Name:            info.Name,
		ResourceRequest: info.IsResourceRequest,
		Path:            info.Path,
	}
}

const (
	base             = "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/dashboards"
	searchPath       = base + "/search"
	hybridSearchPath = searchPath + "/hybrid"
	trashPath        = base + "/trash"
	listPath         = base
)

func TestIsSearchRequest(t *testing.T) {
	for _, path := range []string{searchPath, trashPath, hybridSearchPath, hybridSearchPath + "/", hybridSearchPath + "?timeout=30s"} {
		attr := attributesFor(t, http.MethodPost, path)
		require.Equal(t, "create", attr.GetVerb())
		require.Equal(t, "dashboards", attr.GetResource())
		assert.True(t, IsSearchRequest(attr), "path %s", path)
	}
	hybrid := attributesFor(t, http.MethodPost, hybridSearchPath)
	require.Equal(t, "search", hybrid.GetName())
	require.Equal(t, "hybrid", hybrid.GetSubresource())

	// Creating a dashboard posts to the collection, so it carries no name and
	// must not be mistaken for a search.
	createAttr := attributesFor(t, http.MethodPost, listPath)
	require.Empty(t, createAttr.GetName())
	assert.False(t, IsSearchRequest(createAttr))

	assert.False(t, IsSearchRequest(attributesFor(t, http.MethodGet, listPath)))

	// An object may legitimately be named "search" or "trash", and is only ever
	// reached with a non-create verb.
	for _, path := range []string{searchPath, trashPath, hybridSearchPath} {
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodGet, path)), "path %s", path)
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodPut, path)), "path %s", path)
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodPatch, path)), "path %s", path)
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodDelete, path)), "path %s", path)
	}

	// A subresource named "search" is a different endpoint and not ours.
	sub := attributesFor(t, http.MethodPost, base+"/my-dash/search")
	require.Equal(t, "search", sub.GetSubresource())
	assert.False(t, IsSearchRequest(sub))

	for _, path := range []string{
		base + "/hybrid", base + "/my-dash/hybrid", searchPath + "/status", trashPath + "/hybrid",
		"/apis/dashboard.grafana.app/v0alpha1/dashboards/search/hybrid",
		hybridSearchPath + "/reindex",
	} {
		assert.False(t, IsSearchRequest(attributesFor(t, http.MethodPost, path)), "path %s", path)
	}
	hybrid.ResourceRequest = false
	assert.False(t, IsSearchRequest(hybrid))
}

func TestAsReadAttributes(t *testing.T) {
	for _, path := range []string{searchPath, trashPath, hybridSearchPath} {
		t.Run(path, func(t *testing.T) {
			attr := attributesFor(t, http.MethodPost, path)
			attr.User = &user.DefaultInfo{Name: "viewer", UID: "123", Groups: []string{"team"}}
			fieldSelector, err := fields.ParseSelector("metadata.name=example")
			require.NoError(t, err)
			attr.FieldSelectorRequirements = fieldSelector.Requirements()
			labelSelector, err := labels.Parse("team=search")
			require.NoError(t, err)
			attr.LabelSelectorRequirements, _ = labelSelector.Requirements()
			attr.FieldSelectorParsingErr = errors.New("field selector error")
			attr.LabelSelectorParsingErr = errors.New("label selector error")

			read := AsReadAttributes(attr)

			// Both synthetic path segments must be cleared to authorize the parent kind.
			want := attr
			want.Verb = "list"
			want.Name = ""
			want.Subresource = ""
			assert.Equal(t, want, read)
			assert.True(t, read.IsReadOnly())
			assert.Same(t, attr.User, read.GetUser())
		})
	}
}

// The org role authorizer allows a viewer to list but not to create, which is why
// the restatement has to happen before the chain.
func TestGrafanaAuthorizer_ViewerMaySearchButNotCreate(t *testing.T) {
	a := NewGrafanaBuiltInSTAuthorizer()
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID:     1,
		Namespace: "default",
		OrgRole:   org.RoleViewer,
	})
	for _, tc := range []struct {
		path string
		want authorizer.Decision
	}{
		{searchPath, authorizer.DecisionAllow},
		{trashPath, authorizer.DecisionAllow},
		{hybridSearchPath, authorizer.DecisionAllow},
		{listPath, authorizer.DecisionDeny},
		{base + "/my-dash/hybrid", authorizer.DecisionDeny},
		{searchPath + "/status", authorizer.DecisionDeny},
		{trashPath + "/hybrid", authorizer.DecisionDeny},
		{hybridSearchPath + "/reindex", authorizer.DecisionDeny},
	} {
		t.Run(tc.path, func(t *testing.T) {
			attr := attributesFor(t, http.MethodPost, tc.path)
			attr.User = &user.DefaultInfo{Name: "viewer"}
			decision, _, err := a.Authorize(ctx, attr)
			require.NoError(t, err)
			assert.Equal(t, tc.want, decision)
		})
	}
}

func TestGrafanaAuthorizer_HybridSearchUsesParentListPermission(t *testing.T) {
	for _, tc := range []struct {
		name    string
		allowed bool
		want    authorizer.Decision
	}{
		{"allowed", true, authorizer.DecisionAllow},
		{"denied", false, authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ident := newTestAuthInfo()
			ctx := types.WithAuthInfo(context.Background(), ident)
			called := false
			checker := &fakeAccessChecker{
				checkFunc: func(gotCtx context.Context, gotIdent types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
					called = true
					assert.Same(t, ctx, gotCtx)
					assert.Same(t, ident, gotIdent)
					assert.Equal(t, types.CheckRequest{
						Verb:      "list",
						Group:     "dashboard.grafana.app",
						Resource:  "dashboards",
						Namespace: "default",
						Path:      hybridSearchPath,
					}, req)
					assert.Empty(t, extra)
					return types.CheckResponse{Allowed: tc.allowed}, nil
				},
			}
			a := &GrafanaAuthorizer{auth: NewResourceAuthorizerWithSubresourceHandlers(checker, nil)}
			decision, _, err := a.Authorize(ctx, attributesFor(t, http.MethodPost, hybridSearchPath))
			require.NoError(t, err)
			assert.True(t, called)
			assert.Equal(t, tc.want, decision)
		})
	}
}

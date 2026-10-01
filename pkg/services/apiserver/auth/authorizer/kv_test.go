package authorizer

// Tests for the kv subresource authorizer helpers.
//
// GrafanaAuthorizer detects kv/kv:batch requests on declaring
// kinds (tracked by kvregistry) and rewrites them to a get on the parent
// resource (subresource cleared) before delegating to the normal chain.
// IsKVRequest performs the detection; AsParentGetAttributes performs the
// rewrite. The authorizerForAPI no longer contains kv-specific logic.
//
// Unique group names prevent cross-test interference with the process-wide
// kvregistry singleton.

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/services/apiserver/kvregistry"
)

// kvAuthzGroup / kvAuthzResource are registered once at package init so every
// subtest in this file can rely on HasKV returning true. The group name must
// not be used by any other test package in this process.
const kvAuthzGroup = "kv-authz-test.grafana.app"
const kvAuthzResource = "widgets"

func init() {
	kvregistry.Register(kvAuthzGroup, kvAuthzResource)
}

// kvAttr builds a resource AttributesRecord for the registered test kind with
// the given subresource and verb.
func kvAttr(subresource, verb string) authorizer.AttributesRecord {
	return authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        kvAuthzGroup,
		APIVersion:      "v1",
		Resource:        kvAuthzResource,
		Subresource:     subresource,
		Name:            "obj1",
		Namespace:       "default",
		Verb:            verb,
	}
}

// ── IsKVRequest ───────────────────────────────────────────────────────────────

func TestIsKVRequest(t *testing.T) {
	t.Parallel()

	// Registered kind: kv and kv:batch subresources → true regardless of verb.
	assert.True(t, IsKVRequest(kvAttr("kv", "get")))
	assert.True(t, IsKVRequest(kvAttr("kv", "update")))
	assert.True(t, IsKVRequest(kvAttr("kv:batch", "create")))

	// Unregistered kind: must not trigger even if the subresource is kv.
	unregistered := authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        "never-registered-kv.grafana.app",
		Resource:        "things",
		Subresource:     "kv",
		Verb:            "get",
	}
	assert.False(t, IsKVRequest(unregistered), "unregistered kind must not be detected as kv")

	// Registered kind, other subresources (including empty) → false.
	for _, sub := range []string{"status", "scale", "annotations", ""} {
		assert.False(t, IsKVRequest(kvAttr(sub, "get")), "subresource=%q", sub)
	}

	// Non-resource request → false.
	nonResource := authorizer.AttributesRecord{
		ResourceRequest: false,
		Path:            "/healthz",
	}
	assert.False(t, IsKVRequest(nonResource))
}

// ── AsParentGetAttributes ─────────────────────────────────────────────────────

func TestAsParentGetAttributes(t *testing.T) {
	t.Parallel()

	u := &k8suser.DefaultInfo{Name: "alice", Groups: []string{"devs"}}

	for _, verb := range []string{"get", "update", "delete", "create"} {
		verb := verb
		t.Run("verb="+verb, func(t *testing.T) {
			t.Parallel()
			input := authorizer.AttributesRecord{
				ResourceRequest: true,
				User:            u,
				Verb:            verb,
				APIGroup:        kvAuthzGroup,
				APIVersion:      "v1",
				Resource:        kvAuthzResource,
				Subresource:     "kv",
				Name:            "my-widget",
				Namespace:       "stack-99",
			}
			out := AsParentGetAttributes(input)

			assert.Equal(t, "get", out.GetVerb(), "verb must be rewritten to get")
			assert.Empty(t, out.GetSubresource(), "subresource must be cleared")
			assert.True(t, out.IsResourceRequest())
			assert.Equal(t, kvAuthzGroup, out.GetAPIGroup())
			assert.Equal(t, "v1", out.GetAPIVersion())
			assert.Equal(t, kvAuthzResource, out.GetResource())
			assert.Equal(t, "my-widget", out.GetName())
			assert.Equal(t, "stack-99", out.GetNamespace())
			assert.Equal(t, u, out.GetUser(), "user must be preserved")
		})
	}
}

// ── GrafanaAuthorizer.Authorize with kv rewrite ───────────────────────────────

// TestGrafanaAuthorizer_KVRewritesAsParentGet verifies that kv/kv:batch
// requests are rewritten to a parent get before the inner authorizer sees them,
// that non-kv and unregistered-kind requests pass through unchanged, and that
// the inner decision is returned as-is.
//
// This mirrors TestGrafanaAuthorizer_ViewerMaySearchButNotCreate in search_test.go.
func TestGrafanaAuthorizer_KVRewritesAsParentGet(t *testing.T) {
	t.Parallel()

	type call struct {
		verb        string
		subresource string
	}

	cases := []struct {
		name       string
		attr       authorizer.Attributes
		wantVerb   string
		wantSub    string
		innerDecis authorizer.Decision
	}{
		{
			name:       "kv GET is rewritten to parent get",
			attr:       kvAttr("kv", "get"),
			wantVerb:   "get",
			wantSub:    "",
			innerDecis: authorizer.DecisionAllow,
		},
		{
			name:       "kv PUT is rewritten to parent get",
			attr:       kvAttr("kv", "update"),
			wantVerb:   "get",
			wantSub:    "",
			innerDecis: authorizer.DecisionNoOpinion,
		},
		{
			name:       "kv:batch is rewritten to parent get",
			attr:       kvAttr("kv:batch", "create"),
			wantVerb:   "get",
			wantSub:    "",
			innerDecis: authorizer.DecisionDeny,
		},
		{
			name:       "non-kv subresource passes through unchanged",
			attr:       kvAttr("status", "get"),
			wantVerb:   "get",
			wantSub:    "status",
			innerDecis: authorizer.DecisionNoOpinion,
		},
		{
			name: "unregistered kind kv passes through unchanged",
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				APIGroup:        "never-registered-kv.grafana.app",
				Resource:        "things",
				Subresource:     "kv",
				Verb:            "get",
			},
			wantVerb:   "get",
			wantSub:    "kv",
			innerDecis: authorizer.DecisionNoOpinion,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var got call
			recorder := authorizer.AuthorizerFunc(
				func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
					got = call{verb: attr.GetVerb(), subresource: attr.GetSubresource()}
					return tc.innerDecis, "", nil
				})

			a := &GrafanaAuthorizer{auth: recorder}
			d, _, err := a.Authorize(context.Background(), tc.attr)
			require.NoError(t, err)

			assert.Equal(t, tc.wantVerb, got.verb)
			assert.Equal(t, tc.wantSub, got.subresource)
			assert.Equal(t, tc.innerDecis, d, "inner decision must be returned as-is")
		})
	}
}

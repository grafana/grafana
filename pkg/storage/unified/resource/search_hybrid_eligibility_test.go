package resource

import (
	"context"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type serviceReadRequester struct {
	*identity.StaticRequester
	identities []string
}

func (u *serviceReadRequester) GetExtra() map[string][]string {
	return map[string][]string{authnlib.ServiceIdentityKey: u.identities}
}

func serviceReadContext(subject authlib.IdentityType, identities ...string) context.Context {
	requester := &identity.StaticRequester{Type: subject, Namespace: "ns"}
	if subject == authlib.TypeUser {
		requester.AccessToken = "verified-access-token"
		requester.AccessTokenClaims = &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{
			DelegatedPermissions: []string{"g/r:get"},
		}}
	}
	return authlib.WithAuthInfo(context.Background(), &serviceReadRequester{
		StaticRequester: requester,
		identities:      identities,
	})
}

func TestHybridSearch_AllowedReadServices(t *testing.T) {
	for _, shared := range []bool{false, true} {
		for _, tc := range []struct {
			name       string
			subject    authlib.IdentityType
			identities []string
			policy     map[string][]string
			wantDenied bool
		}{
			{name: "another service", subject: authlib.TypeAccessPolicy, identities: []string{"other"}, policy: map[string][]string{"g/r": {"assistant"}}, wantDenied: true},
			{name: "missing identity", subject: authlib.TypeAccessPolicy, policy: map[string][]string{"g/r": {"assistant"}}, wantDenied: true},
			{name: "multiple identities", subject: authlib.TypeAccessPolicy, identities: []string{"assistant", "other"}, policy: map[string][]string{"g/r": {"assistant"}}, wantDenied: true},
			{name: "user with assistant claim and delegated grant", subject: authlib.TypeUser, identities: []string{"assistant"}, policy: map[string][]string{"g/r": {"assistant"}}, wantDenied: true},
			{name: "unconfigured user", subject: authlib.TypeUser},
		} {
			name := tc.name
			if shared {
				name += " shared"
			}
			t.Run(name, func(t *testing.T) {
				backend := &fakeVectorBackend{results: []vector.VectorSearchResult{{UID: "memory", Title: "Memory", Score: 0.1}}}
				s, index, embedder := newHybridTestServer(lexFieldValueResponse(), backend)
				if shared {
					backend.collection = &vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared}
					s.sharedCollectionAllowlist = vector.NewCollectionAllowlist(nil, []string{"g/r"})
					s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)
					s.externalLexical = &fakeLexicalSearcher{hits: []vector.LexicalHit{{UID: "memory", Title: "Memory"}}}
				}
				s.allowedReadServices = tc.policy
				resp, err := s.HybridSearch(serviceReadContext(tc.subject, tc.identities...), &resourcepb.HybridSearchRequest{Key: validKey(), Query: "memory"})
				if tc.wantDenied {
					require.Equal(t, codes.PermissionDenied, status.Code(err))
					require.Nil(t, resp)
					require.Zero(t, backend.resolveCalls)
					require.Nil(t, index.gotReq)
					require.Empty(t, embedder.gotIn.Texts)
					return
				}
				require.NoError(t, err)
				require.NotNil(t, resp)
				if shared {
					require.Nil(t, index.gotReq)
					require.Len(t, resp.Results, 1)
				} else {
					require.NotNil(t, index.gotReq)
				}
			})
		}
	}
}

func TestVectorSearch_AllowedReadServices(t *testing.T) {
	for _, shared := range []bool{false, true} {
		for _, tc := range []struct {
			name       string
			subject    authlib.IdentityType
			identity   string
			restricted bool
			wantDenied bool
		}{
			{name: "other service with get grant", subject: authlib.TypeAccessPolicy, identity: "other", restricted: true, wantDenied: true},
			{name: "allowed service with get grant", subject: authlib.TypeAccessPolicy, identity: "assistant", restricted: true},
			{name: "user with assistant identity and get grant", subject: authlib.TypeUser, identity: "assistant", restricted: true, wantDenied: true},
			{name: "unconfigured user", subject: authlib.TypeUser},
		} {
			name := tc.name
			if shared {
				name += " shared"
			}
			t.Run(name, func(t *testing.T) {
				backend := &fakeVectorBackend{
					collection: &vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true},
					results:    []vector.VectorSearchResult{{UID: "memory", Title: "Memory", Score: 0.1}},
				}
				access := NewAuthzLimitedClient(authzlib.NewClient(nil), AuthzOptions{Registry: prometheus.NewRegistry()})
				embedder := &fakeTextEmbedder{dim: 4}
				s := newTestSearchServer(newTestEmbedder(embedder), backend, access)
				if shared {
					backend.collection.Scope = vector.ScopeShared
					s.sharedCollectionAllowlist = vector.NewCollectionAllowlist(nil, []string{"g/r"})
					s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)
				}
				if tc.restricted {
					s.allowedReadServices = map[string][]string{"g/r": {"assistant"}}
				}
				caller := &identity.StaticRequester{
					Type: tc.subject, Namespace: "ns", AccessToken: "verified-access-token",
					AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{
						ServiceIdentity: tc.identity, Permissions: []string{"g/r:get"},
					}},
				}
				resp, err := s.VectorSearch(authlib.WithAuthInfo(t.Context(), caller), &resourcepb.VectorSearchRequest{Key: validKey(), Query: "memory"})
				if tc.wantDenied {
					require.Equal(t, codes.PermissionDenied, status.Code(err))
					require.Nil(t, resp)
					require.Zero(t, backend.resolveCalls)
					require.Empty(t, embedder.gotIn.Texts)
					return
				}
				require.NoError(t, err)
				require.Nil(t, resp.Error)
				require.Len(t, resp.Results, 1)
				require.Equal(t, "memory", resp.Results[0].Name)
			})
		}
	}
}

func TestHybridSearch_ExternalServiceStillNeedsGetPermission(t *testing.T) {
	const group, resource = "assistant.inframemories.ext.grafana.app", "inframemories"
	const collection = group + "/" + resource
	for _, tc := range []struct {
		name, permission, namespace string
		wantAuthzError              bool
	}{
		{name: "missing get permission", permission: "folder.grafana.app/folders:get", wantAuthzError: true},
		{name: "wrong verb", permission: collection + ":update", wantAuthzError: true},
		{name: "direct get permission", permission: collection + ":get"},
		{name: "cross tenant", permission: collection + ":get", namespace: "other"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := &fakeVectorBackend{
				collection: &vector.Collection{Group: group, Resource: resource, PartitionKey: resource, IsExternal: true},
				results:    []vector.VectorSearchResult{{UID: "memory", Title: "Memory", Score: 0.1}},
			}
			lexical := &fakeLexicalSearcher{hits: []vector.LexicalHit{{UID: "memory", Title: "Memory"}}}
			// Direct service grants resolve locally. A user-mapper RPC through this nil connection fails.
			access := NewAuthzLimitedClient(authzlib.NewClient(nil), AuthzOptions{Registry: prometheus.NewRegistry()})
			s, index, _ := newHybridTestServer(lexFieldValueResponse(), backend, access)
			s.externalLexical = lexical
			s.collectionAllowlist = vector.NewCollectionAllowlist(nil, []string{collection})
			s.allowedReadServices = map[string][]string{collection: {"assistant"}}
			caller := &identity.StaticRequester{
				Type: authlib.TypeAccessPolicy, Namespace: "ns", AccessToken: "verified-access-token",
				AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{
					ServiceIdentity: "assistant", Permissions: []string{tc.permission},
				}},
			}
			key := &resourcepb.ResourceKey{Namespace: "ns", Group: group, Resource: resource}
			if tc.namespace != "" {
				key.Namespace = tc.namespace
			}
			resp, err := s.HybridSearch(authlib.WithAuthInfo(t.Context(), caller), &resourcepb.HybridSearchRequest{Key: key, Query: "memory"})
			if tc.namespace != "" {
				require.Equal(t, codes.PermissionDenied, status.Code(err))
				require.Nil(t, resp)
				require.Zero(t, backend.resolveCalls)
				require.False(t, lexical.called)
				return
			}
			if tc.wantAuthzError {
				require.Equal(t, codes.Internal, status.Code(err))
				require.Nil(t, resp, "failed authorization must not return a partial response")
				require.Positive(t, backend.resolveCalls)
				return
			}
			require.NoError(t, err)
			require.Len(t, resp.Results, 1)
			require.Equal(t, "memory", resp.Results[0].Key.Name)
			require.True(t, lexical.called)
			require.Nil(t, index.gotReq, "external search must not use the resource index")
		})
	}
}

func TestHybridSearch_RestrictedLaterTargetRejectsWholeRequest(t *testing.T) {
	for _, shared := range []bool{false, true} {
		for _, lexicalOnly := range []bool{false, true} {
			name := map[bool]string{false: "semantic", true: "lexical fallback"}[lexicalOnly]
			if shared {
				name += " with shared first target"
			}
			t.Run(name, func(t *testing.T) {
				backend := &fakeVectorBackend{}
				s, index, embedder := newHybridTestServer(lexFieldValueResponse(), backend)
				if shared {
					backend.collection = &vector.Collection{Group: "g", Resource: "r", PartitionKey: "r_external", IsExternal: true, Scope: vector.ScopeShared}
					s.sharedCollectionAllowlist = vector.NewCollectionAllowlist(nil, []string{"g/r"})
					s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)
					s.externalLexical = &fakeLexicalSearcher{}
				}
				s.allowedReadServices = map[string][]string{"g/secret": {"assistant"}}
				if lexicalOnly {
					s.embedder, s.vectorBackend = nil, nil
				}
				resp, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
					Namespace: "ns", Query: "memory",
					Resources: []*resourcepb.HybridSearchRequest_Resource{{Group: "g", Resource: "r"}, {Group: "g", Resource: "secret"}},
				})
				require.Equal(t, codes.PermissionDenied, status.Code(err))
				require.Nil(t, resp)
				require.Nil(t, index.gotReq)
				require.Empty(t, embedder.gotIn.Texts)
				require.Zero(t, backend.resolveCalls)
			})
		}
	}
}

func TestNewSearchServerEnforcesAllowedReadServices(t *testing.T) {
	index := &hybridFakeIndex{resp: lexFieldValueResponse()}
	s, err := newSearchServer(SearchOptions{
		Backend:             &fakeSearchBackend{idx: index},
		Resources:           &countingBuilderSupplier{},
		AllowedReadServices: map[string][]string{"g/r": {"assistant"}},
	}, nil, nil, nil, nil, authlib.FixedAccessClient(true), nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, s)
	req := &resourcepb.HybridSearchRequest{Key: validKey(), Query: "memory"}
	resp, err := s.HybridSearch(authedCtx(), req)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	require.Nil(t, resp)
	require.Nil(t, index.gotReq)

	resp, err = s.HybridSearch(serviceReadContext(authlib.TypeAccessPolicy, "assistant"), req)
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, index.gotReq)
}

func TestHybridSearch_GlobalMetricLabels(t *testing.T) {
	s, _ := newHybridResourcesTestServer(nil)
	registry := prometheus.NewRegistry()
	registry.MustRegister(s.vectorMetrics.HybridSearchDuration)
	for _, name := range []string{"widgets", "gadgets"} {
		_, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
			Namespace: "ns", Query: "cpu", RequireHybridEnabled: true,
			Resources: []*resourcepb.HybridSearchRequest_Resource{{Group: name + ".example.com", Resource: name}},
		})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	}
	metrics, err := registry.Gather()
	require.NoError(t, err)
	require.Len(t, metrics, 1)
	require.Len(t, metrics[0].Metric, 1, "rejected resource names must not create separate metric series")
	metric := metrics[0].Metric[0]
	labels := make(map[string]string, len(metric.Label))
	for _, label := range metric.Label {
		labels[label.GetName()] = label.GetValue()
	}
	assert.Equal(t, map[string]string{
		"group": GlobalSearchGroup, "resource": GlobalSearchResource, "status_code": codes.InvalidArgument.String(),
	}, labels)
	assert.Equal(t, uint64(2), metric.GetHistogram().GetSampleCount())
}

func TestHybridSearch_RequiresManifestOptIn(t *testing.T) {
	for _, tc := range []struct {
		name        string
		enabled     bool
		require     bool
		external    bool
		extSuffix   bool
		disallowed  bool
		lexicalOnly bool
		target      *resourcepb.HybridSearchRequest_Resource
		want        codes.Code
	}{
		{name: "internal enabled", enabled: true, require: true},
		{name: "internal disabled", require: true, want: codes.InvalidArgument},
		{name: "app group suffix does not bypass opt-in", extSuffix: true, require: true, want: codes.InvalidArgument},
		{name: "pushed collection needs no manifest", external: true, require: true},
		{name: "pushed collection still needs enrollment", external: true, require: true, disallowed: true, want: codes.NotFound},
		{name: "lexical fallback enabled", lexicalOnly: true, enabled: true, require: true},
		{name: "lexical fallback disabled", lexicalOnly: true, require: true, want: codes.InvalidArgument},
		{name: "lexical fallback rejects group case variant", lexicalOnly: true, enabled: true, require: true, target: &resourcepb.HybridSearchRequest_Resource{Group: "G", Resource: "r"}, want: codes.InvalidArgument},
		{name: "lexical fallback rejects resource case variant", lexicalOnly: true, enabled: true, require: true, target: &resourcepb.HybridSearchRequest_Resource{Group: "g", Resource: "R"}, want: codes.InvalidArgument},
		{name: "custom RPC caller keeps existing behavior"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			key := validKey()
			if tc.extSuffix {
				key.Group = "example.ext.grafana.app"
			}
			backend := &fakeVectorBackend{collection: &vector.Collection{
				Group: key.Group, Resource: key.Resource, PartitionKey: "r", IsExternal: tc.external,
			}}
			s, index, embedder := newHybridTestServer(lexFieldValueResponse(), backend)
			lexical := &fakeLexicalSearcher{}
			s.externalLexical = lexical
			if tc.lexicalOnly {
				s.embedder, s.vectorBackend = nil, nil
			}
			if tc.disallowed {
				s.collectionAllowlist = vector.NewCollectionAllowlist(nil, nil)
			} else {
				allowed := []string{key.Group + "/" + key.Resource}
				s.collectionAllowlist = vector.NewCollectionAllowlist(allowed, allowed)
			}
			manifest := hybridConfigManifest(hybridConfigVersion("v1", &tc.enabled))
			manifest.Group = key.Group
			manifest.Versions[0].Kinds[0].Plural = key.Resource
			s.hybridSearchConfig = NewHybridSearchConfigRegistry([]*app.ManifestData{manifest})
			target := tc.target
			if target == nil {
				target = &resourcepb.HybridSearchRequest_Resource{Group: key.Group, Resource: key.Resource}
			}
			response, err := s.HybridSearch(authedCtx(), &resourcepb.HybridSearchRequest{
				Namespace: key.Namespace, Query: "cpu", RequireHybridEnabled: tc.require,
				Resources: []*resourcepb.HybridSearchRequest_Resource{target},
			})
			require.Equal(t, tc.want, status.Code(err), err)
			if tc.want != codes.OK {
				assert.Nil(t, response)
				assert.Nil(t, index.gotReq)
				assert.False(t, lexical.called)
				assert.Empty(t, embedder.gotIn.Texts)
				return
			}
			require.NotNil(t, response)
		})
	}
}

func TestHybridSearch_LiveOptOutRejectsWholeRequest(t *testing.T) {
	manifest := hybridConfigManifest(hybridConfigVersion("v1", ptr.To(true)))
	manifest.Versions[0].Kinds = append(manifest.Versions[0].Kinds, app.ManifestVersionKind{
		Kind: "Gadget", Scope: "Namespaced", Search: &app.ManifestVersionKindSearch{Hybrid: ptr.To(true)},
	})
	options := SearchOptions{HybridSearchConfig: NewHybridSearchConfigRegistry(nil)}
	s, index := newHybridResourcesTestServer(nil)
	s.hybridSearchConfig = options.HybridSearchConfig
	req := &resourcepb.HybridSearchRequest{
		Namespace: "ns", Query: "cpu", RequireHybridEnabled: true,
		Resources: []*resourcepb.HybridSearchRequest_Resource{
			{Group: manifest.Group, Resource: "widgets"},
			{Group: manifest.Group, Resource: "gadgets"},
		},
	}
	for _, enabled := range []bool{true, false, true} {
		manifest.Versions[0].Kinds[1].Search.Hybrid = ptr.To(enabled)
		require.NoError(t, options.ReloadManifests(nil, []*app.ManifestData{manifest}))
		clear(index.requests)
		response, err := s.HybridSearch(authedCtx(), req)
		if !enabled {
			require.Equal(t, codes.InvalidArgument, status.Code(err))
			assert.ErrorContains(t, err, manifest.Group+"/gadgets")
			assert.Nil(t, response)
			assert.Empty(t, index.requests, "reject all targets before either search starts")
			continue
		}
		require.NoError(t, err)
		assert.NotNil(t, response)
		assert.Len(t, index.requests, 2)
	}
}

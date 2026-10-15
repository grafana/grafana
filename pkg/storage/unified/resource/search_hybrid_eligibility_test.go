package resource

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

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
			s, index, embedder := newHybridTestServer(lexTableResponse(), backend)
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

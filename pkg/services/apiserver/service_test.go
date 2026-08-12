package apiserver

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"

	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/services/user"
)

func Test_useNamespaceFromPath(t *testing.T) {
	tests := []struct {
		name  string
		path  string
		expNs string
	}{
		{
			name:  "no namespace in path",
			path:  "/apis/folder.grafana.app/",
			expNs: "",
		},
		{
			name:  "namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/stacks-11/folders",
			expNs: "stacks-11",
		},
		{
			name:  "invalid namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/invalid/folders",
			expNs: "invalid",
		},
		{
			name:  "org namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/org-123/folders",
			expNs: "org-123",
		},
		{
			name:  "default namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/default/folders",
			expNs: "default",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &user.SignedInUser{}
			useNamespaceFromPath(tt.path, user)
			if user.Namespace != tt.expNs {
				require.Equal(t, tt.expNs, user.Namespace, "expected namespace to be %s, got %s", tt.expNs, user.Namespace)
			}
		})
	}
}

const testGroup = "dashboard.grafana.app"

// testOrder mirrors testDiscoveryScheme's natural priority as the resolver's registered-version snapshot.
var testOrder = map[string][]string{testGroup: {"v2", "v1", "v0alpha1"}}

// newTestRegistry builds a registry over testOrder with the given ini layer (nil for none). Shared by the
// discovery and poller tests.
func newTestRegistry(ini map[string]versionpolicy.VersionPolicy) *versionpolicy.VersionPolicyRegistry {
	return versionpolicy.NewVersionPolicyRegistry(versionpolicy.NewResolver(testOrder), nil, ini)
}

// testDiscoveryScheme registers the group's versions with the scheme's natural
// priority v2 > v1 > v0alpha1, so groupPriority reads production's real seam
// (scheme.PrioritizedVersionsForGroup) rather than a hand-rolled fake.
func testDiscoveryScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()
	gvs := []schema.GroupVersion{
		{Group: testGroup, Version: "v2"},
		{Group: testGroup, Version: "v1"},
		{Group: testGroup, Version: "v0alpha1"},
	}
	for _, gv := range gvs {
		scheme.AddKnownTypes(gv, &metav1.Status{})
	}
	require.NoError(t, scheme.SetVersionPriority(gvs...))
	return scheme
}

// servedGroupVersions runs the aggregated discovery document through the real
// handler and returns the versions the group actually advertises, in served
// order — i.e. after the priority changes reprioritizeDiscovery applied.
func servedGroupVersions(t *testing.T, mgr discoveryendpoint.ResourceManager, group string) []string {
	t.Helper()
	disScheme := runtime.NewScheme()
	utilruntime.Must(apidiscoveryv2.AddToScheme(disScheme))
	codecs := serializer.NewCodecFactory(disScheme)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList")
	mgr.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	doc := &apidiscoveryv2.APIGroupDiscoveryList{}
	require.NoError(t, runtime.DecodeInto(codecs.UniversalDecoder(), w.Body.Bytes(), doc))

	for _, g := range doc.Items {
		if g.Name != group {
			continue
		}
		versions := make([]string, 0, len(g.Versions))
		for _, v := range g.Versions {
			versions = append(versions, v.Version)
		}
		return versions
	}
	t.Fatalf("group %q not present in discovery document", group)
	return nil
}

// reprioritizeDiscovery floats the global preferred version first in what
// aggregated discovery serves, and reverts to the scheme's natural order when
// no preferred is set. Driven end-to-end: real scheme -> real discovery manager
// -> served document.
func TestReprioritizeDiscovery_ServedOrder(t *testing.T) {
	scheme := testDiscoveryScheme(t)

	tests := []struct {
		name      string
		preferred string
		want      []string
	}{
		{name: "global preferred floats first", preferred: "v1", want: []string{"v1", "v2", "v0alpha1"}},
		{name: "no preferred keeps natural order", preferred: "", want: []string{"v2", "v1", "v0alpha1"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var ini map[string]versionpolicy.VersionPolicy
			if tt.preferred != "" {
				ini = map[string]versionpolicy.VersionPolicy{testGroup: {PreferredVersion: tt.preferred}}
			}
			reg := newTestRegistry(ini)

			mgr := discoveryendpoint.NewResourceManager("apis")
			for _, v := range testOrder[testGroup] {
				mgr.AddGroupVersion(testGroup, apidiscoveryv2.APIVersionDiscovery{Version: v})
			}

			s := &service{
				vpRegistry:             reg,
				groupPriority:          scheme.PrioritizedVersionsForGroup,
				groupDiscoveryPriority: map[string]int{testGroup: 15003},
				discoveryManager:       mgr,
			}
			s.reprioritizeDiscovery()

			require.Equal(t, tt.want, servedGroupVersions(t, mgr, testGroup))
		})
	}
}

// With no discovery manager captured yet, reprioritize is a no-op (no panic).
func TestReprioritizeDiscovery_NoManagerNoop(t *testing.T) {
	s := &service{vpRegistry: newTestRegistry(nil), groupPriority: testDiscoveryScheme(t).PrioritizedVersionsForGroup}
	require.NotPanics(t, s.reprioritizeDiscovery)
}

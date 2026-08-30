package router

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"
)

func TestQuoteETag(t *testing.T) {
	got := quoteETag("abc123")
	want := `"abc123"`
	if got != want {
		t.Errorf("quoteETag(%q) = %q, want %q", "abc123", got, want)
	}
}

// fakeBackend is a minimal Backend for discovery/cache tests. handler is
// unused by discovery tests (zero value is fine); the per-group-version
// cache tests in a later task set it.
type fakeBackend struct {
	group    string
	rv       string
	manifest app.ManifestData
	handler  http.Handler
}

func (b *fakeBackend) RV() string                 { return b.rv }
func (b *fakeBackend) Group() string              { return b.group }
func (b *fakeBackend) Manifest() app.ManifestData { return b.manifest }
func (b *fakeBackend) Load(context.Context) (http.Handler, error) {
	if b.handler != nil {
		return b.handler, nil
	}
	return http.NotFoundHandler(), nil
}

func TestBuildAPIGroupList(t *testing.T) {
	backends := []Backend{
		&fakeBackend{group: "dashboard.grafana.app", rv: "10", manifest: app.ManifestData{
			Group:            "dashboard.grafana.app",
			PreferredVersion: "v1alpha1",
			Versions: []app.ManifestVersion{
				{Name: "v0alpha1", Served: true},
				{Name: "v1alpha1", Served: true},
				{Name: "v2alpha1", Served: false}, // unserved: must be excluded
			},
		}},
		&fakeBackend{group: "folder.grafana.app", rv: "3", manifest: app.ManifestData{
			Group:            "folder.grafana.app",
			PreferredVersion: "v0alpha1",
			Versions:         []app.ManifestVersion{{Name: "v0alpha1", Served: true}},
		}},
	}

	doc := buildAPIGroupList(backends)

	var list metav1.APIGroupList
	if err := json.Unmarshal(doc.body, &list); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if list.Kind != "APIGroupList" || list.APIVersion != "v1" {
		t.Errorf("got Kind=%q APIVersion=%q, want APIGroupList/v1", list.Kind, list.APIVersion)
	}
	if len(list.Groups) != 2 {
		t.Fatalf("got %d groups, want 2 (broken.grafana.app must be skipped): %+v", len(list.Groups), list.Groups)
	}
	// sorted alphabetically: dashboard before folder
	if list.Groups[0].Name != "dashboard.grafana.app" {
		t.Errorf("got Groups[0].Name=%q, want dashboard.grafana.app", list.Groups[0].Name)
	}
	if len(list.Groups[0].Versions) != 2 {
		t.Errorf("got %d served versions for dashboard.grafana.app, want 2 (v2alpha1 unserved excluded): %+v",
			len(list.Groups[0].Versions), list.Groups[0].Versions)
	}
	wantPreferred := metav1.GroupVersionForDiscovery{GroupVersion: "dashboard.grafana.app/v1alpha1", Version: "v1alpha1"}
	if list.Groups[0].PreferredVersion != wantPreferred {
		t.Errorf("got PreferredVersion=%+v, want %+v", list.Groups[0].PreferredVersion, wantPreferred)
	}
	if doc.etag == "" {
		t.Error("etag must not be empty")
	}
}

func TestBuildAPIGroupListETagChangesWithRV(t *testing.T) {
	mk := func(rv string) []Backend {
		return []Backend{&fakeBackend{group: "dashboard.grafana.app", rv: rv, manifest: app.ManifestData{
			Group:    "dashboard.grafana.app",
			Versions: []app.ManifestVersion{{Name: "v1alpha1", Served: true}},
		}}}
	}
	a := buildAPIGroupList(mk("1"))
	b := buildAPIGroupList(mk("2"))
	if a.etag == b.etag {
		t.Errorf("etag did not change when RV changed: both %q", a.etag)
	}
}

func TestBuildOpenAPIV3Index(t *testing.T) {
	backends := []Backend{
		&fakeBackend{group: "dashboard.grafana.app", rv: "10", manifest: app.ManifestData{
			Group: "dashboard.grafana.app",
			Versions: []app.ManifestVersion{
				{Name: "v0alpha1", Served: true},
				{Name: "v1alpha1", Served: false}, // unserved: excluded
			},
		}},
	}

	doc := buildOpenAPIV3Index(backends)

	var idx handler3.OpenAPIV3Discovery
	if err := json.Unmarshal(doc.body, &idx); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(idx.Paths) != 1 {
		t.Fatalf("got %d paths, want 1: %+v", len(idx.Paths), idx.Paths)
	}
	entry, ok := idx.Paths["apis/dashboard.grafana.app/v0alpha1"]
	if !ok {
		t.Fatalf("missing path apis/dashboard.grafana.app/v0alpha1, got %+v", idx.Paths)
	}
	want := "/openapi/v3/apis/dashboard.grafana.app/v0alpha1?hash=10"
	if entry.ServerRelativeURL != want {
		t.Errorf("got ServerRelativeURL=%q, want %q", entry.ServerRelativeURL, want)
	}
}

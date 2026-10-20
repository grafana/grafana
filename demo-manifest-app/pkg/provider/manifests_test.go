package provider

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kindv1alpha1 "github.com/demo/manifest/pkg/generated/kind/v1alpha1"
)

func kindObject(namespace, apiGroup, name string) kindv1alpha1.Kind {
	return kindv1alpha1.Kind{
		ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: apiGroup + "-" + name},
		Spec:       kindv1alpha1.Spec{ApiGroup: apiGroup, Name: name},
	}
}

func TestBuildManifestsGroupsByNamespaceAndAPIGroup(t *testing.T) {
	h := &manifestsHandler{ownerGroup: "demomanifestapp.ext.grafana.app"}
	manifests := h.buildManifests([]kindv1alpha1.Kind{
		kindObject("default", "shop", "Widget"),
		kindObject("default", "shop", "Gadget"),
		kindObject("default", "shop", "Widget"), // duplicate
		kindObject("stacks-1", "shop", "Widget"),
		kindObject("default", "library", "Book"),
	})

	got := map[string][]string{}
	for _, m := range manifests {
		for _, k := range m.Versions[0].Kinds {
			got[m.Group] = append(got[m.Group], k.Kind+"/"+k.Plural)
		}
	}
	want := map[string][]string{
		"library.default.demomanifestapp.ext.grafana.app": {"Book/books"},
		"shop.default.demomanifestapp.ext.grafana.app":    {"Gadget/gadgets", "Widget/widgets"},
		"shop.stacks-1.demomanifestapp.ext.grafana.app":   {"Widget/widgets"},
	}
	if len(got) != len(want) {
		t.Fatalf("got groups %v, want %v", got, want)
	}
	for group, kinds := range want {
		if len(got[group]) != len(kinds) {
			t.Fatalf("group %s: got %v, want %v", group, got[group], kinds)
		}
		for i := range kinds {
			if got[group][i] != kinds[i] {
				t.Fatalf("group %s: got %v, want %v", group, got[group], kinds)
			}
		}
	}
	if manifests[0].Group != "library.default.demomanifestapp.ext.grafana.app" {
		t.Fatalf("manifests are not sorted by group: first is %s", manifests[0].Group)
	}
	if manifests[0].Versions[0].Kinds[0].Schema == nil {
		t.Fatal("declared kind has no schema")
	}
}

func TestPageParams(t *testing.T) {
	for _, tc := range []struct {
		query         string
		limit, offset int
		wantErr       bool
	}{
		{query: "", limit: 100},
		{query: "limit=2&continue=4", limit: 2, offset: 4},
		{query: "limit=0", wantErr: true},
		{query: "continue=x", wantErr: true},
	} {
		u, _ := url.Parse("/apis/g/v1alpha1/_manifests?" + tc.query)
		limit, offset, err := pageParams(&app.CustomRouteRequest{URL: u})
		if (err != nil) != tc.wantErr {
			t.Fatalf("%q: err = %v, wantErr %v", tc.query, err, tc.wantErr)
		}
		if !tc.wantErr && (limit != tc.limit || offset != tc.offset) {
			t.Fatalf("%q: got limit %d offset %d, want %d %d", tc.query, limit, offset, tc.limit, tc.offset)
		}
	}
}

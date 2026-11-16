// Package smoke runs a CRUD smoke test across versions for every resource the
// server serves, without any per-resource test code.
package smoke

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	"sigs.k8s.io/yaml"

	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/compat"
)

func TestMain(m *testing.M) {
	compat.Main(m)
}

// written records one object the setup version created. The later phases read
// this list instead of guessing what the other version wrote.
type written struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Version  string `json:"version"`
	Name     string `json:"name"`
	// Spec and ResourceVersion as the setup version read the object back after creating it.
	Spec            json.RawMessage `json:"spec"`
	ResourceVersion string          `json:"resourceVersion"`
	// Updated is set by the update phase once it rewrote the object's metadata. It stays
	// unset for resources the other version does not serve or stores in legacy storage,
	// so the verify phase only expects that metadata where it was written.
	Updated bool `json:"updated"`
	// UpdatedIn is the API version the update phase wrote the object in.
	UpdatedIn string `json:"updatedIn,omitempty"`
}

const (
	touchedLabel      = "compat.grafana.app/touched"
	patchedAnnotation = "compat.grafana.app/patched"
	// serverNamedAnnotation in a fixture leaves metadata.name empty on create, for
	// resources whose server derives the name from the spec.
	serverNamedAnnotation = "compat.grafana.app/server-named"
)

// TestCompatSetup creates one object per resource.
func TestCompatSetup(t *testing.T) {
	dir := compat.Dir(t)
	h := compat.NewHelper(t)
	skips, stale := readSkipFile(t).resolve()
	served := compat.Served(t, h)
	ctx := context.Background()

	for gr, flag := range stale {
		t.Run("stale-skip/"+gr.String(), func(t *testing.T) {
			t.Fatalf("the %s feature flag is on in this build, so remove %s from feature_flags in skip.yaml to test it", flag, gr)
		})
	}

	var out []written
	for _, gr := range slices.SortedFunc(maps.Keys(served), compareGR) {
		if reason, ok := skips[gr]; ok {
			t.Logf("skipping %s: %s", gr, reason)
			continue
		}
		t.Run(gr.String(), func(t *testing.T) {
			obj := newObject(t, h, gr, served[gr])
			gv, err := schema.ParseGroupVersion(obj.GetAPIVersion())
			require.NoError(t, err)

			client := resourceClient(h, gr, gv.Version)
			created, err := client.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err, "add a fixture in %s or an entry in skip.yaml", fixturePath(gr))
			got, err := client.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			out = append(out, written{
				Group: gr.Group, Resource: gr.Resource, Version: gv.Version, Name: got.GetName(),
				Spec: specJSON(t, got), ResourceVersion: got.GetResourceVersion(),
			})
		})
	}
	writeManifest(t, dir, out)
}

// TestCompatUpdate runs on the other version: it reads every object, rewrites it with
// an update and a patch, and checks that stale writes are rejected.
func TestCompatUpdate(t *testing.T) {
	dir := compat.Dir(t)
	entries := readManifest(t, dir)
	h := compat.NewHelper(t)
	f := readSkipFile(t)
	skips, _ := f.resolve()
	served := compat.Served(t, h)
	ctx := context.Background()

	for i, e := range entries {
		gr := e.gr()
		t.Run(gr.String(), func(t *testing.T) {
			res := servedOrSkip(t, served, skips, e)
			readEverywhere(t, h, e, res)

			// Write in this version's preferred version, as clients do, so an object stored in
			// another version is converted on the way.
			client := resourceClient(h, gr, res.Versions[0])
			entries[i].UpdatedIn = res.Versions[0]
			obj, err := client.Get(ctx, e.Name, metav1.GetOptions{})
			require.NoError(t, err)
			setLabel(obj, touchedLabel, "true")
			updated, err := client.Update(ctx, obj, metav1.UpdateOptions{})
			require.NoError(t, err, "update%s", hint(e, res))
			if reason, ok := f.LegacyStorage[gr.String()]; ok {
				// Legacy stores drop labels, so a kept label means the resource moved to a store
				// that gets the full checks.
				require.NotEqual(t, "true", updated.GetLabels()[touchedLabel], "%s keeps labels now; remove it from legacy_storage in skip.yaml so it gets the full checks", gr)
				t.Logf("legacy storage, skipping metadata, stale write and patch checks: %s", reason)
				return
			}
			require.Equal(t, "true", updated.GetLabels()[touchedLabel], "update dropped the label; if the storage cannot keep labels, list the resource under legacy_storage in skip.yaml")

			if reason, ok := f.StaleWritesAccepted[gr.String()]; ok {
				// Rewriting the same content with the old resourceVersion is harmless if accepted.
				stale := updated.DeepCopy()
				stale.SetResourceVersion(e.ResourceVersion)
				_, err = client.Update(ctx, stale, metav1.UpdateOptions{})
				require.False(t, apierrors.IsConflict(err), "%s rejects stale writes now; remove it from stale_writes_accepted in skip.yaml", gr)
				t.Logf("skipping stale write checks: %s", reason)
			} else {
				// The label is a real change, so the setup version's resourceVersion is stale now.
				require.NotEqual(t, e.ResourceVersion, updated.GetResourceVersion(), "update did not advance the resourceVersion")
				stale := updated.DeepCopy()
				stale.SetResourceVersion(e.ResourceVersion)
				_, err = client.Update(ctx, stale, metav1.UpdateOptions{})
				require.True(t, apierrors.IsConflict(err), "stale update: expected a conflict, got %v", err)
				err = client.Delete(ctx, e.Name, metav1.DeleteOptions{Preconditions: &metav1.Preconditions{ResourceVersion: &e.ResourceVersion}})
				require.True(t, apierrors.IsConflict(err), "stale delete: expected a conflict, got %v", err)
			}

			before, err := client.Get(ctx, e.Name, metav1.GetOptions{})
			require.NoError(t, err, "get after rejected stale writes")
			patch := fmt.Sprintf(`{"metadata":{"annotations":{%q:"true"}}}`, patchedAnnotation)
			_, err = client.Patch(ctx, e.Name, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
			require.NoError(t, err, "patch%s", hint(e, res))
			after, err := client.Get(ctx, e.Name, metav1.GetOptions{})
			require.NoError(t, err)
			require.JSONEq(t, string(specJSON(t, before)), string(specJSON(t, after)), "a metadata patch changed the spec")
			require.Equal(t, "true", after.GetAnnotations()[patchedAnnotation])
			require.Equal(t, "true", after.GetLabels()[touchedLabel])
			entries[i].Updated = true
		})
	}
	writeManifest(t, dir, entries)
}

// TestCompatVerify runs on the setup version again, after the other version rewrote
// every object: the spec must read back exactly as it was written. Then it deletes
// everything and checks the objects are gone.
func TestCompatVerify(t *testing.T) {
	dir := compat.Dir(t)
	entries := readManifest(t, dir)
	h := compat.NewHelper(t)
	skips, _ := readSkipFile(t).resolve()
	served := compat.Served(t, h)
	ctx := context.Background()

	for _, e := range entries {
		gr := e.gr()
		t.Run(gr.String(), func(t *testing.T) {
			res := servedOrSkip(t, served, skips, e)
			readEverywhere(t, h, e, res)

			got, err := resourceClient(h, gr, e.Version).Get(ctx, e.Name, metav1.GetOptions{})
			require.NoError(t, err)
			requireConverted(t, got, "get in "+e.Version)
			if e.UpdatedIn == "" || e.UpdatedIn == e.Version {
				require.JSONEq(t, string(e.Spec), string(specJSON(t, got)), "spec changed after the other version read or rewrote the object")
			} else {
				// Converting to another API version and back may drop empty fields and add
				// defaults, but must keep every value that was set.
				var want, have any
				require.NoError(t, json.Unmarshal(e.Spec, &want))
				require.NoError(t, json.Unmarshal(specJSON(t, got), &have))
				require.NoError(t, preservationError(want, have, "spec"))
			}
			if e.Updated {
				require.Equal(t, "true", got.GetLabels()[touchedLabel], "label from the other version")
				require.Equal(t, "true", got.GetAnnotations()[patchedAnnotation], "annotation from the other version")
			}
		})
	}

	// Delete in reverse creation order, so objects that reference others (rules in a
	// folder) go before what they reference.
	for _, e := range slices.Backward(entries) {
		gr := e.gr()
		t.Run("delete/"+gr.String(), func(t *testing.T) {
			res := servedOrSkip(t, served, skips, e)
			client := resourceClient(h, gr, res.Versions[0])
			require.NoError(t, client.Delete(ctx, e.Name, metav1.DeleteOptions{}), "delete%s", hint(e, res))
			_, err := client.Get(ctx, e.Name, metav1.GetOptions{})
			require.True(t, apierrors.IsNotFound(err), "get after delete: expected not found, got %v", err)
			list, err := client.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.False(t, slices.ContainsFunc(list.Items, named(e.Name)), "list still contains %s after delete", e.Name)
		})
	}
}

func (e written) gr() schema.GroupResource {
	return schema.GroupResource{Group: e.Group, Resource: e.Resource}
}

func resourceClient(h *apis.K8sTestHelper, gr schema.GroupResource, version string) dynamic.ResourceInterface {
	return h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: gr.WithVersion(version)}).Resource
}

// servedOrSkip returns how this version serves the resource of an entry the other version
// wrote. It skips the entry when this version skips the resource itself, for example
// behind a feature flag that is off here, or does not serve it at all. The newer version
// must keep serving what the older one wrote, unless its skip.yaml says why not.
func servedOrSkip(t *testing.T, served map[schema.GroupResource]compat.Resource, skips map[schema.GroupResource]string, e written) compat.Resource {
	t.Helper()
	gr := e.gr()
	if reason, ok := skips[gr]; ok {
		t.Skipf("this version skips %s: %s", gr, reason)
	}
	res, ok := served[gr]
	if !ok {
		if compat.IsNewer() {
			t.Fatalf("the older version wrote %s, which the newer version no longer serves; if that is intended within the compatibility window, list it in skip.yaml with the reason", gr)
		}
		t.Skipf("%s is not served by this version", gr)
	}
	if compat.IsNewer() && !slices.Contains(res.Versions, e.Version) {
		t.Fatalf("the older version wrote %s in %s, which the newer version no longer serves", gr, e.Version)
	}
	return res
}

// readEverywhere gets the object in every version this server serves and finds it in a list.
func readEverywhere(t *testing.T, h *apis.K8sTestHelper, e written, res compat.Resource) {
	t.Helper()
	ctx := context.Background()
	for _, v := range res.Versions {
		obj, err := resourceClient(h, e.gr(), v).Get(ctx, e.Name, metav1.GetOptions{})
		require.NoError(t, err, "get in %s%s", v, hint(e, res))
		requireConverted(t, obj, "get in "+v)
	}
	list, err := resourceClient(h, e.gr(), res.Versions[0]).List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "list%s", hint(e, res))
	i := slices.IndexFunc(list.Items, named(e.Name))
	require.GreaterOrEqual(t, i, 0, "list does not contain %s", e.Name)
	requireConverted(t, &list.Items[i], "list in "+res.Versions[0])
}

// requireConverted fails when the server reports in status.conversion that it could not
// convert the object to the requested version. The read still succeeds then, with a
// placeholder spec, so the status is the only sign.
func requireConverted(t *testing.T, obj *unstructured.Unstructured, what string) {
	t.Helper()
	failed, _, _ := unstructured.NestedBool(obj.Object, "status", "conversion", "failed")
	if failed {
		msg, _, _ := unstructured.NestedString(obj.Object, "status", "conversion", "error")
		t.Fatalf("%s: conversion failed: %s", what, msg)
	}
}

// hint explains the most likely cause when this version cannot handle an object at all.
func hint(e written, res compat.Resource) string {
	if slices.Contains(res.Versions, e.Version) {
		return ""
	}
	return fmt.Sprintf("; stored in %s, which this version does not serve (preferred and max API versions must not go beyond what the oldest running version serves)", e.Version)
}

// preservationError reports the first value in want that is missing or different in got.
// A conversion may drop empty values (null, "", false, [], and objects holding only empty
// values) and add fields, but a value that is still there must not change.
func preservationError(want, got any, path string) error {
	switch w := want.(type) {
	case map[string]any:
		g, ok := got.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: expected an object, got %v", path, got)
		}
		for k, v := range w {
			gv, ok := g[k]
			if !ok {
				if isEmpty(v) {
					continue
				}
				return fmt.Errorf("%s.%s was lost", path, k)
			}
			if err := preservationError(v, gv, path+"."+k); err != nil {
				return err
			}
		}
	case []any:
		g, ok := got.([]any)
		if !ok || len(g) != len(w) {
			return fmt.Errorf("%s: expected %v, got %v", path, want, got)
		}
		for i := range w {
			if err := preservationError(w[i], g[i], fmt.Sprintf("%s[%d]", path, i)); err != nil {
				return err
			}
		}
	default:
		if !reflect.DeepEqual(want, got) {
			return fmt.Errorf("%s: expected %v, got %v", path, want, got)
		}
	}
	return nil
}

func isEmpty(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return x == ""
	case bool:
		return !x
	case map[string]any:
		for _, v := range x {
			if !isEmpty(v) {
				return false
			}
		}
		return true
	case []any:
		return len(x) == 0
	}
	return false
}

func named(name string) func(unstructured.Unstructured) bool {
	return func(o unstructured.Unstructured) bool { return o.GetName() == name }
}

func setLabel(obj *unstructured.Unstructured, key, value string) {
	labels := obj.GetLabels()
	if labels == nil {
		labels = map[string]string{}
	}
	labels[key] = value
	obj.SetLabels(labels)
}

func specJSON(t *testing.T, obj *unstructured.Unstructured) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(obj.Object["spec"])
	require.NoError(t, err)
	return raw
}

func writeManifest(t *testing.T, dir string, entries []written) {
	t.Helper()
	raw, err := json.MarshalIndent(entries, "", "  ")
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(manifestPath(dir), raw, 0o600))
}

func readManifest(t *testing.T, dir string) []written {
	t.Helper()
	raw, err := os.ReadFile(manifestPath(dir))
	require.NoError(t, err, "run TestCompatSetup first")
	var entries []written
	require.NoError(t, json.Unmarshal(raw, &entries))
	return entries
}

// newObject loads testdata/<group>/<resource>.yaml when present. Otherwise it builds
// an object with an empty spec in the preferred version, which is enough for
// resources without required spec fields.
func newObject(t *testing.T, h *apis.K8sTestHelper, gr schema.GroupResource, res compat.Resource) *unstructured.Unstructured {
	t.Helper()
	name := "compat-smoke-" + gr.Resource

	if _, err := os.Stat(fixturePath(gr)); err == nil {
		obj := h.LoadYAMLOrJSONFile(fixturePath(gr))
		annotations := obj.GetAnnotations()
		if _, serverNamed := annotations[serverNamedAnnotation]; serverNamed {
			delete(annotations, serverNamedAnnotation)
			obj.SetAnnotations(annotations)
		} else if obj.GetName() == "" {
			obj.SetName(name)
		}
		return obj
	} else if !errors.Is(err, fs.ErrNotExist) {
		require.NoError(t, err)
	}

	obj := &unstructured.Unstructured{Object: map[string]any{"spec": map[string]any{}}}
	obj.SetAPIVersion(gr.WithVersion(res.Versions[0]).GroupVersion().String())
	obj.SetKind(res.Kind)
	obj.SetName(name)
	return obj
}

// skipFile is skip.yaml. Every map is keyed by "<resource>.<group>"; the values are
// reasons, except in FeatureFlags, where they are the flag the resource needs.
type skipFile struct {
	FeatureFlags        map[string]string `json:"feature_flags"`
	All                 map[string]string `json:"all"`
	OSS                 map[string]string `json:"oss"`
	Enterprise          map[string]string `json:"enterprise"`
	LegacyStorage       map[string]string `json:"legacy_storage"`
	StaleWritesAccepted map[string]string `json:"stale_writes_accepted"`
}

func readSkipFile(t *testing.T) skipFile {
	t.Helper()
	raw, err := os.ReadFile("skip.yaml")
	require.NoError(t, err)
	var f skipFile
	require.NoError(t, yaml.UnmarshalStrict(raw, &f))
	return f
}

// resolve returns why this build skips each resource it skips: those skipped in every
// build, those skipped in this build (oss or enterprise), and those behind a feature
// flag that is off in the running server. Call it after the server started, so flags
// evaluate as the server evaluates them. stale lists the feature_flags entries whose
// flag is on, which should be tested instead.
func (f skipFile) resolve() (skips map[schema.GroupResource]string, stale map[schema.GroupResource]string) {
	reasons := maps.Clone(f.All)
	if extensions.IsEnterprise {
		maps.Copy(reasons, f.Enterprise)
	} else {
		maps.Copy(reasons, f.OSS)
	}
	skips = map[schema.GroupResource]string{}
	stale = map[schema.GroupResource]string{}
	for key, reason := range reasons {
		skips[schema.ParseGroupResource(key)] = reason
	}
	ctx := context.Background()
	for key, flag := range f.FeatureFlags {
		gr := schema.ParseGroupResource(key)
		if openfeature.NewDefaultClient().Boolean(ctx, flag, false, openfeature.TransactionContext(ctx)) {
			stale[gr] = flag
			continue
		}
		skips[gr] = fmt.Sprintf("writes need the %s feature flag, which is off in this build", flag)
	}
	return skips, stale
}

func fixturePath(gr schema.GroupResource) string {
	return filepath.Join("testdata", gr.Group, gr.Resource+".yaml")
}

func manifestPath(dir string) string {
	return filepath.Join(dir, "smoke.json")
}

func compareGR(a, b schema.GroupResource) int {
	return cmp.Or(strings.Compare(a.Group, b.Group), strings.Compare(a.Resource, b.Resource))
}

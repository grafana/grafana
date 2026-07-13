// Package resourcekinds holds a generic, table-driven provisioning integration-test harness.
// It exercises the full files/jobs pipeline (export, selective export, sync/pull, files CRUD,
// and bulk delete/move jobs) against each registered resource type.
//
// Adding coverage for a new resource type is one thing: drop a JSON descriptor in
// testdata/kinds/. The descriptor carries a sample manifest plus the two bits that cannot be
// derived from a manifest — whether the kind is folder-scoped, and any feature flags it needs.
// Everything else (the plural resource, the [provisioning] resources tokens, the per-kind
// subtests) is derived automatically.
//
//	testdata/kinds/<name>.json:
//	  {
//	    "folderScoped": false,                 // does sync stamp a grafana.app/folder annotation?
//	    "featureFlags": ["playlistsRBAC"],     // extra feature toggles the kind needs (often none)
//	    "manifest": { "apiVersion": "...", "kind": "...", "metadata": {...}, "spec": {...} }
//	  }
package resourcekinds

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"path"
	"strings"
	"sync"
	"testing"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/restmapper"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

//go:embed testdata/kinds/*.json
var kindsFS embed.FS

// kindSpec is the on-disk descriptor for one resource type (testdata/kinds/<name>.json).
type kindSpec struct {
	// FolderScoped reports whether sync stamps a grafana.app/folder annotation on the resource.
	FolderScoped bool `json:"folderScoped"`
	// FeatureFlags are extra feature toggles the kind needs (raw toggle names, e.g. "playlistsRBAC").
	FeatureFlags []string `json:"featureFlags"`
	// Manifest is a sample resource manifest; the harness patches its name and spec.title per instance.
	Manifest json.RawMessage `json:"manifest"`
}

// resourceKind is a loaded descriptor the harness drives.
type resourceKind struct {
	name         string // descriptor filename stem; used for subtests, repo names, resource names
	group        string
	version      string
	kind         string
	folderScoped bool
	featureFlags []string
	manifest     []byte
}

// resourceKinds is the table the generic harness runs, loaded from testdata/kinds/.
var resourceKinds = mustLoadKinds()

func mustLoadKinds() []resourceKind {
	const dir = "testdata/kinds"
	entries, err := kindsFS.ReadDir(dir)
	if err != nil {
		panic(fmt.Sprintf("resourcekinds: reading %s: %v", dir, err))
	}

	var kinds []resourceKind
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		raw, err := kindsFS.ReadFile(path.Join(dir, e.Name()))
		if err != nil {
			panic(fmt.Sprintf("resourcekinds: reading %s: %v", e.Name(), err))
		}

		var spec kindSpec
		if err := json.Unmarshal(raw, &spec); err != nil {
			panic(fmt.Sprintf("resourcekinds: %s: %v", e.Name(), err))
		}

		var meta struct {
			APIVersion string `json:"apiVersion"`
			Kind       string `json:"kind"`
		}
		if err := json.Unmarshal(spec.Manifest, &meta); err != nil {
			panic(fmt.Sprintf("resourcekinds: %s: invalid manifest: %v", e.Name(), err))
		}
		group, version, ok := strings.Cut(meta.APIVersion, "/")
		if !ok || group == "" || version == "" || meta.Kind == "" {
			panic(fmt.Sprintf("resourcekinds: %s: manifest needs apiVersion=<group>/<version> and kind", e.Name()))
		}

		kinds = append(kinds, resourceKind{
			name:         strings.TrimSuffix(e.Name(), ".json"),
			group:        group,
			version:      version,
			kind:         meta.Kind,
			folderScoped: spec.FolderScoped,
			featureFlags: spec.FeatureFlags,
			manifest:     []byte(spec.Manifest),
		})
	}
	if len(kinds) == 0 {
		panic("resourcekinds: no kind descriptors found in " + dir)
	}
	return kinds
}

// groupPrefix is the apiVersion prefix used to find this kind's exported files.
func (rk resourceKind) groupPrefix() string { return rk.group + "/" }

// token is the [provisioning] resources entry that enables this kind (active, folder-scoped or not).
func (rk resourceKind) token() string {
	if rk.folderScoped {
		return rk.group + "/" + rk.kind + ":folder"
	}
	return rk.group + "/" + rk.kind
}

// unifiedStorageKey is the [unified_storage] config key (<resource>.<group>) for this kind. The
// plural resource is derived from the kind name; the descriptors under test follow the regular
// lowercase-plural convention (Dashboard->dashboards, LibraryPanel->librarypanels). If a derived
// key is wrong the kind silently falls back to its default storage, so the dimension tests fail
// loudly rather than passing on the wrong backend.
func (rk resourceKind) unifiedStorageKey() string {
	return strings.ToLower(rk.kind) + "s." + rk.group
}

// instance returns a deterministic (name, title) pair for the i-th resource of this kind.
func (rk resourceKind) instance(i int) (name, title string) {
	return fmt.Sprintf("%s-%d", rk.name, i), fmt.Sprintf("%s %d", rk.kind, i)
}

// newResource builds a resource manifest from the descriptor's sample, patching name and title.
func (rk resourceKind) newResource(t *testing.T, name, title string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{}
	require.NoError(t, obj.UnmarshalJSON(rk.manifest), "decode manifest for %s", rk.name)
	obj.SetName(name)
	require.NoError(t, unstructured.SetNestedField(obj.Object, title, "spec", "title"))
	return obj
}

// gvrCache memoizes the discovery-resolved plural resource per kind.
var gvrCache sync.Map // schema.GroupVersionKind -> schema.GroupVersionResource

// gvr resolves the plural resource for this kind via the apiserver's discovery, so the
// descriptor only needs the manifest's group/version/kind.
func (rk resourceKind) gvr(t *testing.T, helper *common.ProvisioningTestHelper) schema.GroupVersionResource {
	t.Helper()
	gvk := schema.GroupVersionKind{Group: rk.group, Version: rk.version, Kind: rk.kind}
	if v, ok := gvrCache.Load(gvk); ok {
		return v.(schema.GroupVersionResource)
	}
	groupResources, err := restmapper.GetAPIGroupResources(helper.NewDiscoveryClient())
	require.NoError(t, err, "should read API discovery")
	mapping, err := restmapper.NewDiscoveryRESTMapper(groupResources).RESTMapping(gvk.GroupKind(), gvk.Version)
	require.NoError(t, err, "should resolve the plural resource for %s", gvk)
	gvrCache.Store(gvk, mapping.Resource)
	return mapping.Resource
}

// client returns a dynamic client for this kind scoped to Org1 admin in the default namespace.
func (rk resourceKind) client(t *testing.T, helper *common.ProvisioningTestHelper) *apis.K8sResourceClient {
	t.Helper()
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       rk.gvr(t, helper),
	})
}

// env runs a single shared Grafana server with every descriptor's kind enabled.
var env = common.NewSharedEnv(harnessOptions(resourceKinds)...)

// harnessOptions builds the shared-server options from the descriptors: it enables every kind's
// provisioning token (folders stay enabled as they are foundational) and the union of the
// feature flags the kinds require.
func harnessOptions(kinds []resourceKind) []common.GrafanaOption {
	tokens := make([]string, 0, 1+len(kinds))
	tokens = append(tokens, "folder.grafana.app/Folder:folder")
	seenFlag := map[string]bool{}
	var flags []string
	for _, rk := range kinds {
		tokens = append(tokens, rk.token())
		for _, f := range rk.featureFlags {
			if !seenFlag[f] {
				seenFlag[f] = true
				flags = append(flags, f)
			}
		}
	}
	return []common.GrafanaOption{
		common.WithoutProvisioningFolderMetadata,
		func(opts *testinfra.GrafanaOpts) {
			// Setting [provisioning] resources replaces the default set.
			opts.ProvisioningResources = tokens
			opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, flags...)
			// Serve every kind under test from unified storage (Mode5). Provisioning round-trips
			// the manager/source annotations through that backend; legacy stores backing some
			// kinds (e.g. library panels via library_element) have nowhere to persist them.
			if opts.UnifiedStorageConfig == nil {
				opts.UnifiedStorageConfig = map[string]setting.UnifiedStorageConfig{}
			}
			for _, rk := range kinds {
				opts.UnifiedStorageConfig[rk.unifiedStorageKey()] = setting.UnifiedStorageConfig{
					DualWriterMode: grafanarest.Mode5,
				}
			}
		},
	}
}

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

// postResourceFile creates a resource at path via the files endpoint, which both stores the
// file in the repository and provisions the resource into Grafana.
func postResourceFile(t *testing.T, ctx context.Context, helper *common.ProvisioningTestHelper, rk resourceKind, repo, filePath, name, title string) {
	t.Helper()
	res := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("files", filePath).
		Body(common.ResourceToJSON(t, rk.newResource(t, name, title))).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, res.Error(), "creating %s via the files endpoint should succeed", filePath)
}

// repositoryFilePaths returns the set of file paths currently in the repository.
func repositoryFilePaths(t *testing.T, ctx context.Context, helper *common.ProvisioningTestHelper, repo string) []string {
	t.Helper()
	items := helper.ListRepositoryFiles(t, ctx, repo)
	paths := make([]string, 0, len(items))
	for _, item := range items {
		paths = append(paths, item.Path)
	}
	return paths
}

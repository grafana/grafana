package kvsubresource

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	app "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/kvregistry"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var injectLog = log.New("kvsubresource.inject")

// InjectForManifest adds {plural}/kv and {plural}/kv:batch storage entries to g
// for every NAMESPACED kind in manifest whose version declares kv (HasKV()).
// The parent resource's existing storage entry is used as the Getter.
// KVResponse is registered in g.Scheme for each affected group-version so
// OpenAPI model generation can locate the type.
//
// No-op (with a debug log) when manifest, kvClient, or access is nil.
// Individual kinds are skipped silently when their parent storage is absent or
// does not implement rest.Getter.
func InjectForManifest(
	g *genericapiserver.APIGroupInfo,
	manifest *app.ManifestData,
	kvClient resourcepb.ResourceKVClient,
	access accesscontrol.AccessControl,
) {
	if manifest == nil || kvClient == nil || access == nil {
		injectLog.Debug("skipping KV injection: nil manifest or dependencies")
		return
	}
	for _, version := range manifest.Versions {
		storageMap, ok := g.VersionedResourcesStorageMap[version.Name]
		if !ok {
			continue
		}
		for i := range version.Kinds {
			kind := &version.Kinds[i]
			if !kind.HasKV() || kind.Scope != "Namespaced" {
				continue
			}
			resource := kind.Resource()
			parentStorage, ok := storageMap[resource]
			if !ok {
				injectLog.Debug("KV inject: parent storage not found, skipping",
					"group", manifest.Group, "version", version.Name, "resource", resource)
				continue
			}
			getter, ok := parentStorage.(rest.Getter)
			if !ok {
				injectLog.Debug("KV inject: parent storage is not a Getter, skipping",
					"group", manifest.Group, "version", version.Name, "resource", resource)
				continue
			}
			gr := schema.GroupResource{Group: manifest.Group, Resource: resource}
			conn := NewKVConnector(gr, getter, kvClient, access, kind.KV)
			storageMap[resource+"/kv"] = conn
			storageMap[resource+"/kv:batch"] = conn
			gv := schema.GroupVersion{Group: manifest.Group, Version: version.Name}
			if err := AddToScheme(g.Scheme, gv); err != nil {
				injectLog.Warn("KV inject: failed to register KVResponse in scheme",
					"gv", gv.String(), "err", err)
			}
			// Register with the authz registry so IsKVRequest in GrafanaAuthorizer
			// recognises this group/resource and rewrites kv requests to a parent get.
			kvregistry.Register(manifest.Group, resource)
			injectLog.Debug("KV inject: mounted kv subresource",
				"group", manifest.Group, "version", version.Name, "resource", resource)
		}
	}
}

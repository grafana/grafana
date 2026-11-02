package router

import (
	"maps"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/app/manifestdata"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// discoveryOpenAPIPath is the discovery group's entry in the /openapi/v3 index.
const discoveryOpenAPIPath = "apis/" + discoveryGroup + "/" + manifestDiscoveryVersion

// discoveryOpenAPIDoc is the OpenAPI v3 document of the discovery group,
// served at /openapi/v3/apis/discovery/v1alpha2 like any group version's.
var discoveryOpenAPIDoc = newJSONDoc(buildDiscoveryOpenAPI(appManifestSchemas()))

// appManifestSchemas returns the OpenAPI components of the AppManifest kind,
// from the app-sdk's own manifest. They reference each other as
// #/components/schemas/<name>; "AppManifest" is the object and "spec" its
// spec. nil when the app-sdk no longer ships them.
func appManifestSchemas() map[string]any {
	for _, version := range manifestdata.LocalManifest().ManifestData.Versions {
		if version.Name != appmanifestv1alpha2.APIVersion {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Kind == "AppManifest" && kind.Schema != nil {
				return maps.Clone(kind.Schema.AsOpenAPI3SchemasMap())
			}
		}
	}
	return nil
}

// buildDiscoveryOpenAPI builds the document from the AppManifest components.
// The objects carry no status, so the document leaves it out.
func buildDiscoveryOpenAPI(schemas map[string]any) map[string]any {
	if schemas == nil || schemas["spec"] == nil {
		schemas = map[string]any{"spec": map[string]any{"type": "object"}}
	}
	delete(schemas, "status")

	ref := func(name string) map[string]any {
		return map[string]any{"$ref": "#/components/schemas/" + name}
	}
	// kubectl finds a resource's schema by the kind its discovery reports,
	// which is in the discovery group, while the objects themselves are
	// apps.grafana.app.
	gvks := func(kind string) []map[string]string {
		return []map[string]string{
			{"group": discoveryGroup, "version": manifestDiscoveryVersion, "kind": kind},
			{"group": appmanifestv1alpha2.APIGroup, "version": appmanifestv1alpha2.APIVersion, "kind": kind},
		}
	}
	typeMeta := func(kind string) map[string]any {
		return map[string]any{
			"apiVersion": map[string]any{"type": "string", "description": "Always " + appmanifestv1alpha2.GroupVersion.String() + "."},
			"kind":       map[string]any{"type": "string", "description": "Always " + kind + "."},
		}
	}

	manifest := map[string]any{
		"type":                            "object",
		"description":                     "The app manifest of one served API group. Its name is the group.",
		"required":                        []string{"spec"},
		"properties":                      typeMeta("AppManifest"),
		"x-kubernetes-group-version-kind": gvks("AppManifest"),
	}
	manifest["properties"].(map[string]any)["metadata"] = ref("ObjectMeta")
	manifest["properties"].(map[string]any)["spec"] = ref("spec")
	schemas["AppManifest"] = manifest

	list := map[string]any{
		"type":                            "object",
		"description":                     "The app manifests of every served API group that has one.",
		"required":                        []string{"items"},
		"properties":                      typeMeta("AppManifestList"),
		"x-kubernetes-group-version-kind": gvks("AppManifestList"),
	}
	list["properties"].(map[string]any)["metadata"] = ref("ListMeta")
	list["properties"].(map[string]any)["items"] = map[string]any{"type": "array", "items": ref("AppManifest")}
	schemas["AppManifestList"] = list

	schemas["ObjectMeta"] = map[string]any{
		"type":       "object",
		"properties": map[string]any{"name": map[string]any{"type": "string", "description": "The API group the manifest describes."}},
	}
	schemas["ListMeta"] = map[string]any{"type": "object"}
	schemas["RouterStatus"] = map[string]any{
		"type":        "object",
		"description": "The router's live status, for debugging. Its shape may change between releases.",
	}

	textResponse := func(contentType, description string) map[string]any {
		return map[string]any{"200": map[string]any{
			"description": description,
			"content":     map[string]any{contentType: map[string]any{"schema": map[string]any{"type": "string"}}},
		}}
	}
	jsonResponse := func(description, schemaName string) map[string]any {
		return map[string]any{"200": map[string]any{
			"description": description,
			"content":     map[string]any{"application/json": map[string]any{"schema": ref(schemaName)}},
		}}
	}
	return map[string]any{
		"openapi": "3.0.0",
		"info": map[string]any{
			"title":       discoveryGroup + "/" + manifestDiscoveryVersion,
			"description": "The app manifests of the API groups this server routes.",
			"version":     manifestDiscoveryVersion,
		},
		"paths": map[string]any{
			manifestDiscoveryList: map[string]any{
				"get": map[string]any{
					"operationId": "listDiscoveryV1alpha2Manifest",
					"description": "List the app manifest of every served API group that has one.",
					"parameters": []map[string]any{
						{"name": "labelSelector", "in": "query", "description": "Select by label. Manifests have no labels.", "schema": map[string]any{"type": "string"}},
						{"name": "fieldSelector", "in": "query", "description": "Select by field. Only metadata.name, the API group, is supported.", "schema": map[string]any{"type": "string"}},
					},
					"tags":      []string{discoveryGroup + "_" + manifestDiscoveryVersion},
					"responses": jsonResponse("OK", "AppManifestList"),
				},
			},
			discoveryAgentsMD: map[string]any{
				"get": map[string]any{
					"operationId": "readDiscoveryV1alpha2Agents",
					"description": "Read the markdown index of every served API group, for agents: its kinds, resources, custom routes and OpenAPI documents.",
					"tags":        []string{discoveryGroup + "_" + manifestDiscoveryVersion},
					"responses":   textResponse("text/markdown", "The index, as markdown."),
				},
			},
			manifestDiscoveryStatus: map[string]any{
				"get": map[string]any{
					"operationId": "readDiscoveryV1alpha2Status",
					"description": "Read the router's live status: each served group's source, breaker, backend and caches.",
					"tags":        []string{discoveryGroup + "_" + manifestDiscoveryVersion},
					"responses":   jsonResponse("OK", "RouterStatus"),
				},
			},
			manifestDiscoveryGroups + "{name}": map[string]any{
				"parameters": []map[string]any{{
					"name": "name", "in": "path", "required": true,
					"description": "The API group.", "schema": map[string]any{"type": "string"},
				}},
				"get": map[string]any{
					"operationId": "readDiscoveryV1alpha2Manifest",
					"description": "Read the app manifest of one API group.",
					"tags":        []string{discoveryGroup + "_" + manifestDiscoveryVersion},
					"responses":   jsonResponse("OK", "AppManifest"),
				},
			},
		},
		"components": map[string]any{"schemas": schemas},
	}
}

// discoveryOpenAPIURL is the discovery group's /openapi/v3 index entry,
// cache-busted by the document's own content.
var discoveryOpenAPIURL = openapiV3Prefix + "/" + discoveryOpenAPIPath + "?hash=" + strings.Trim(discoveryOpenAPIDoc.etag, `"`)

func discoveryOpenAPIEntry() (path, serverRelativeURL string) {
	return discoveryOpenAPIPath, discoveryOpenAPIURL
}

// serveDiscoveryOpenAPI serves the discovery group's OpenAPI document.
func serveDiscoveryOpenAPI(w http.ResponseWriter, req *http.Request, version string) {
	setRoute(req, routeDiscovery)
	if version != manifestDiscoveryVersion {
		_ = errhttp.Write(req.Context(), apierrors.NewNotFound(schema.GroupResource{Group: discoveryGroup}, version), w)
		return
	}
	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "OpenAPI documents are read-only", http.StatusMethodNotAllowed)
		return
	}
	serveCachedDoc(w, req, &discoveryOpenAPIDoc)
}

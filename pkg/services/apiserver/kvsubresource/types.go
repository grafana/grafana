package kvsubresource

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// openAPIModelName is the canonical OpenAPI model name for KVResponse.
// It follows the reverse-dotted-path convention used by all other Grafana types
// (e.g. "com.github.grafana.grafana.pkg.apimachinery.apis.common.v0alpha1.Unstructured").
// Implementing OpenAPIModelNamer makes kube-openapi's GetCanonicalTypeName return
// this string as the key for the definitions map, so AddOpenAPIDefinition can
// register the schema under the same key.
const openAPIModelName = "com.github.grafana.grafana.pkg.services.apiserver.kvsubresource.KVResponse"

// KVResponse is the response type registered for the KV subresource in every
// group-version scheme that declares a kv block.  Actual HTTP responses are
// written directly to the http.ResponseWriter; this type exists so that OpenAPI
// model generation can locate a registered kind under the correct group-version
// (using metav1.Status here would crash because it is only registered under
// /v1, not under e.g. dashboard.grafana.app/v1).
//
// C5b calls AddToScheme for each group-version that mounts the subresource.
type KVResponse struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Keys is populated by list operations; omitted from get/write responses.
	Keys []string `json:"keys,omitempty"`
}

// OpenAPIModelName implements util.OpenAPIModelNamer so that kube-openapi uses
// the same stable dotted name for both the definitions-map key and any $ref
// that points to KVResponse.
func (KVResponse) OpenAPIModelName() string {
	return openAPIModelName
}

// DeepCopyObject implements runtime.Object.
func (r *KVResponse) DeepCopyObject() runtime.Object {
	cp := *r
	r.DeepCopyInto(&cp.ObjectMeta)
	if r.Keys != nil {
		cp.Keys = make([]string, len(r.Keys))
		copy(cp.Keys, r.Keys)
	}
	return &cp
}

// AddToScheme registers KVResponse into scheme under gv.
// C5b calls this once per group-version that mounts the KV subresource so that
// OpenAPI model generation can find the type.
func AddToScheme(scheme *runtime.Scheme, gv schema.GroupVersion) error {
	scheme.AddKnownTypeWithName(gv.WithKind("KVResponse"), &KVResponse{})
	return nil
}

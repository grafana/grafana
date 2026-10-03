// Package manifest resolves policy schemas from grafana-app-sdk app manifests.
//
// It is kept apart from the schema package so that environments which resolve schemas
// elsewhere (for example from a live server) do not depend on the app SDK.
package manifest

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	k8sschema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/policy/schema"
)

// NewResolver builds a resolver for every kind and version in the given manifests that has a
// schema. Kinds without one are left out, so policies targeting them fail to compile with
// schema.ErrSchemaNotFound. Schemas are converted up front; the returned error reports the
// kinds whose schemas could not be converted, while the resolver still serves the others.
func NewResolver(manifests ...app.ManifestData) (schema.StaticResolver, error) {
	r := schema.StaticResolver{}
	var errs []error
	for _, m := range manifests {
		for _, v := range m.Versions {
			for _, k := range v.Kinds {
				if k.Schema == nil {
					continue
				}
				gvk := k8sschema.GroupVersionKind{Group: m.Group, Version: v.Name, Kind: k.Kind}
				s, err := convert(k.Schema, k.Kind)
				if err != nil {
					errs = append(errs, fmt.Errorf("converting schema for %s: %w", gvk, err))
					continue
				}
				r[gvk] = s
			}
		}
	}
	return r, errors.Join(errs...)
}

// Resources maps every kind and version in the manifests to its API resource.
func Resources(manifests ...app.ManifestData) map[k8sschema.GroupVersionKind]k8sschema.GroupVersionResource {
	out := map[k8sschema.GroupVersionKind]k8sschema.GroupVersionResource{}
	for _, m := range manifests {
		for _, v := range m.Versions {
			for _, k := range v.Kinds {
				plural := k.Plural
				if plural == "" {
					plural = k.Kind + "s"
				}
				out[k8sschema.GroupVersionKind{Group: m.Group, Version: v.Name, Kind: k.Kind}] = k8sschema.GroupVersionResource{
					Group: m.Group, Version: v.Name, Resource: strings.ToLower(plural),
				}
			}
		}
	}
	return out
}

// convert produces a single schema with all references inlined. Recursive references are
// replaced by objects that preserve unknown fields.
func convert(vs *app.VersionSchema, kind string) (*spec.Schema, error) {
	crd, err := vs.AsCRDOpenAPI3(kind)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(crd)
	if err != nil {
		return nil, err
	}
	s := &spec.Schema{}
	if err := json.Unmarshal(raw, s); err != nil {
		return nil, err
	}
	// The engine adds apiVersion, kind and metadata itself.
	delete(s.Properties, "apiVersion")
	delete(s.Properties, "kind")
	delete(s.Properties, "metadata")
	return s, nil
}

// Package bootstrap applies provisioning manifests from disk to the in-process Grafana apiserver at
// startup, so Git Sync can be configured as mounted files without an imperative API call or
// grafanactl ("configuration as code without grafanactl").
//
// Manifests are standard Kubernetes-style YAML, but only provisioning.grafana.app Repository and
// Connection kinds are applied; any other kind is ignored. Once a Repository is configured, Git
// Sync provisions the remaining resources (dashboards, folders, …) from the repository itself.
package bootstrap

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"path"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"

	"github.com/grafana/grafana/pkg/setting"
)

// defaultNamespace is used when a manifest does not set metadata.namespace. It maps to org 1.
const defaultNamespace = "default"

// ReadManifests reads every *.yaml/*.yml file under dir in fsys, splits multi-document files,
// decodes each document into an unstructured object, expands secret references in string values,
// and validates the result. Files are processed in sorted order for deterministic behaviour.
func ReadManifests(fsys fs.FS, dir string) ([]*unstructured.Unstructured, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, fmt.Errorf("read manifests dir %q: %w", dir, err)
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if ext := strings.ToLower(path.Ext(e.Name())); ext != ".yaml" && ext != ".yml" {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)

	var objs []*unstructured.Unstructured
	for _, name := range names {
		data, err := fs.ReadFile(fsys, path.Join(dir, name))
		if err != nil {
			return nil, fmt.Errorf("read manifest %q: %w", name, err)
		}
		fileObjs, err := decodeManifests(data)
		if err != nil {
			return nil, fmt.Errorf("decode manifest %q: %w", name, err)
		}
		objs = append(objs, fileObjs...)
	}
	return objs, nil
}

// decodeManifests splits a (possibly multi-document) YAML/JSON byte stream into unstructured
// objects, interpolating and validating each one.
func decodeManifests(data []byte) ([]*unstructured.Unstructured, error) {
	decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader(data), 4096)
	var objs []*unstructured.Unstructured
	for {
		var raw map[string]any
		if err := decoder.Decode(&raw); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
		if len(raw) == 0 {
			continue // skip empty documents (e.g. a trailing `---`)
		}
		obj := &unstructured.Unstructured{Object: raw}
		if err := interpolate(obj); err != nil {
			return nil, err
		}
		if err := validate(obj); err != nil {
			return nil, err
		}
		objs = append(objs, obj)
	}
	return objs, nil
}

// interpolate walks every string leaf of the object and expands $__env{VAR} / $__file{/path}
// references via setting.ExpandVar. This keeps secrets out of the manifest files themselves.
func interpolate(obj *unstructured.Unstructured) error {
	expanded, err := expandValue(obj.Object)
	if err != nil {
		return err
	}
	obj.Object = expanded.(map[string]any)
	return nil
}

func expandValue(v any) (any, error) {
	switch t := v.(type) {
	case string:
		return setting.ExpandVar(t)
	case map[string]any:
		for k, val := range t {
			nv, err := expandValue(val)
			if err != nil {
				return nil, err
			}
			t[k] = nv
		}
		return t, nil
	case []any:
		for i, val := range t {
			nv, err := expandValue(val)
			if err != nil {
				return nil, err
			}
			t[i] = nv
		}
		return t, nil
	default:
		return v, nil
	}
}

// validate ensures the object has the required identity fields and defaults the namespace.
func validate(obj *unstructured.Unstructured) error {
	if obj.GetAPIVersion() == "" {
		return fmt.Errorf("manifest is missing apiVersion")
	}
	if obj.GetKind() == "" {
		return fmt.Errorf("manifest is missing kind")
	}
	if obj.GetName() == "" {
		return fmt.Errorf("manifest %s is missing metadata.name", obj.GetKind())
	}
	if obj.GetNamespace() == "" {
		obj.SetNamespace(defaultNamespace)
	}
	return nil
}

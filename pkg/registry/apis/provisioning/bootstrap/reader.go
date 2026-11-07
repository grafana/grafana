// Package bootstrap applies provisioning Repository and Connection manifests from disk to the
// in-process Grafana apiserver at startup, so Git Sync can be configured as mounted files.
package bootstrap

import (
	"bytes"
	"errors"
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

// ReadManifests decodes every *.yaml/*.yml file under dir, in sorted order, expanding secret
// references. Documents are independent: those that parsed are returned even when the error is
// non-nil, so one bad file cannot block the rest.
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
	var errs []error
	for _, name := range names {
		data, err := fs.ReadFile(fsys, path.Join(dir, name))
		if err != nil {
			errs = append(errs, fmt.Errorf("read manifest %q: %w", name, err))
			continue
		}
		fileObjs, err := decodeManifests(data)
		objs = append(objs, fileObjs...)
		if err != nil {
			errs = append(errs, fmt.Errorf("manifest %q: %w", name, err))
		}
	}
	return objs, errors.Join(errs...)
}

// decodeManifests splits a multi-document stream, interpolating and validating each document.
func decodeManifests(data []byte) ([]*unstructured.Unstructured, error) {
	decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader(data), 4096)
	var objs []*unstructured.Unstructured
	var errs []error
	for i := 0; ; i++ {
		var raw map[string]any
		if err := decoder.Decode(&raw); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			// The stream position is unreliable after a decode failure, so stop this file here.
			errs = append(errs, fmt.Errorf("document %d: %w", i, err))
			break
		}
		if len(raw) == 0 {
			continue // skip empty documents (e.g. a trailing `---`)
		}
		obj := &unstructured.Unstructured{Object: raw}
		if err := interpolate(obj); err != nil {
			errs = append(errs, fmt.Errorf("document %d: %w", i, err))
			continue
		}
		if err := validate(obj); err != nil {
			errs = append(errs, fmt.Errorf("document %d: %w", i, err))
			continue
		}
		objs = append(objs, obj)
	}
	return objs, errors.Join(errs...)
}

// interpolate expands $__env{VAR} / $__file{/path} in every string leaf, keeping secrets out of
// the manifest files.
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

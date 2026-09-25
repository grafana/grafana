package unified

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	utilyaml "k8s.io/apimachinery/pkg/util/yaml"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Embedded storage starts before AppManifest provisioning, so load its
// <provisioning>/appmanifests files before building the search index.
func loadEmbeddedAppManifests(provisioningPath string) ([]*app.ManifestData, error) {
	dir := filepath.Join(provisioningPath, "appmanifests")
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", dir, err)
	}

	var manifests []*app.ManifestData
	var errs []error
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		switch strings.ToLower(filepath.Ext(entry.Name())) {
		case ".json", ".yaml", ".yml":
		default:
			continue
		}
		path := filepath.Join(dir, entry.Name())
		// #nosec G304 -- the operator controls the provisioning directory.
		content, err := os.ReadFile(path)
		if err != nil {
			errs = append(errs, fmt.Errorf("reading %s: %w", path, err))
			continue
		}
		decoder := utilyaml.NewYAMLOrJSONDecoder(bytes.NewReader(content), 4096)
		for {
			obj := &unstructured.Unstructured{}
			if err := decoder.Decode(obj); err != nil {
				if errors.Is(err, io.EOF) {
					break
				}
				errs = append(errs, fmt.Errorf("decoding %s: %w", path, err))
				break
			}
			if len(obj.Object) == 0 || obj.GetKind() != "AppManifest" {
				continue
			}
			switch obj.GetAPIVersion() {
			case "apps.grafana.app/v1alpha1":
				continue // v1alpha1 has no search field declarations.
			case "apps.grafana.app/v1alpha2":
			default:
				errs = append(errs, fmt.Errorf("%s: unsupported AppManifest version %q", path, obj.GetAPIVersion()))
				continue
			}
			manifest, err := resource.ManifestFromUnstructured(obj)
			if err != nil {
				errs = append(errs, fmt.Errorf("converting %s: %w", path, err))
				continue
			}
			manifests = append(manifests, manifest)
		}
	}
	return manifests, errors.Join(errs...)
}

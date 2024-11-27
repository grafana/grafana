package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type fileParser struct {
	// Reader is always in the context of a single namespace
	namespace string

	// client helper (for this namespace?)
	client *dynamic.DynamicClient

	kinds *kindsLookup
}

func newFileParser(namespace string, client *dynamic.DynamicClient, kinds *kindsLookup) *fileParser {
	return &fileParser{
		namespace: namespace,
		client:    client,
		kinds:     kinds,
	}
}

type parsedFile struct {
	// Original file info
	info *repository.FileInfo
	// Parsed contents
	obj *unstructured.Unstructured
	// The Kind is defined in the file
	gvk *schema.GroupVersionKind
	// The Resource is found by mapping Kind to the right apiserver
	gvr *schema.GroupVersionResource
	// Client that can talk to this resource
	client dynamic.ResourceInterface

	// The existing object (same name)
	// ?? do we need/want the whole thing??
	existing *unstructured.Unstructured

	// The results from dry run
	dryRunResponse *unstructured.Unstructured

	// If we got some errors
	errors []error
}

func (r *fileParser) parse(ctx context.Context, logger *slog.Logger, info *repository.FileInfo, validate bool) (*parsedFile, error) {
	obj, gvk, err := LoadYAMLOrJSON(bytes.NewBuffer(info.Data))
	if err != nil {
		logger.DebugContext(ctx, "failed to find GVK of the input data", "error", err)
		obj, gvk, err = FallbackResourceLoader(ctx, logger, info.Data)
		if err != nil {
			logger.DebugContext(ctx, "also failed to get GVK from fallback loader?", "error", err)
			return nil, err
		}
	}
	parsed := &parsedFile{
		info: info,
		obj:  obj,
		gvk:  gvk,
	}

	if r.namespace == "" {
		return nil, fmt.Errorf("parser is not configured (missing namespace)")
	}

	// Validate the namespace
	if obj.GetNamespace() != "" && obj.GetNamespace() != r.namespace {
		parsed.errors = append(parsed.errors, ErrNamespaceMismatch)
	}
	obj.SetNamespace(r.namespace)

	// When name is missing use the file path as the k8s name
	if obj.GetName() == "" {
		name := filepath.Base(info.Path)
		suffix := filepath.Ext(name)
		if suffix != "" {
			name = strings.TrimSuffix(name, suffix)
		}
		obj.SetName(name)
	}

	// We can not do anything more if no kind is defined
	if gvk == nil {
		return parsed, nil
	}

	gvr, ok := r.kinds.Resource(*gvk)
	if !ok {
		return parsed, nil
	}

	client := r.client.Resource(gvr).Namespace(r.namespace)
	parsed.gvr = &gvr
	parsed.client = client
	if !validate {
		return parsed, nil
	}

	// Dry run CREATE or UPDATE
	parsed.existing, _ = parsed.client.Get(ctx, obj.GetName(), metav1.GetOptions{})
	if parsed.existing == nil {
		parsed.dryRunResponse, err = parsed.client.Create(ctx, obj, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
	} else {
		parsed.dryRunResponse, err = parsed.client.Update(ctx, obj, metav1.UpdateOptions{
			DryRun: []string{"All"},
		})
	}
	if err != nil {
		parsed.errors = append(parsed.errors, err)
	}
	return parsed, nil
}

func (f *parsedFile) ToSaveBytes() ([]byte, error) {
	// TODO... should use the validated one?
	obj := f.obj.Object
	delete(obj, "metadata")

	switch filepath.Ext(f.info.Path) {
	// JSON pretty print
	case ".json":
		return json.MarshalIndent(obj, "", "  ")

	// Write the value as yaml
	case ".yaml", ".yml":
		return yaml.Marshal(obj)

	default:
		return nil, fmt.Errorf("unexpected format")
	}
}

func (f *parsedFile) AsResourceWrapper() *provisioning.ResourceWrapper {
	info := f.info
	res := provisioning.ResourceObjects{}
	if f.obj != nil {
		res.File = v0alpha1.Unstructured{Object: f.obj.Object}
	}
	if f.existing != nil {
		res.Store = v0alpha1.Unstructured{Object: f.existing.Object}
	}
	if f.dryRunResponse != nil {
		res.DryRun = v0alpha1.Unstructured{Object: f.dryRunResponse.Object}
	}
	wrap := &provisioning.ResourceWrapper{
		Path:      info.Path,
		Ref:       info.Ref,
		Hash:      info.Hash,
		Timestamp: info.Modified,
		Resource:  res,
	}
	for _, err := range f.errors {
		wrap.Errors = append(wrap.Errors, err.Error())
	}
	return wrap
}

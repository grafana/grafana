package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

var ErrNamespaceMismatch = errors.New("the file namespace does not match target namespace")

type FileParser struct {
	// The target repository
	repo repository.Repository

	// client helper (for this namespace?)
	client *DynamicClient
	kinds  *KindsLookup
}

func NewParser(repo repository.Repository, client *DynamicClient, kinds *KindsLookup) *FileParser {
	return &FileParser{
		repo:   repo,
		client: client,
		kinds:  kinds,
	}
}

type ParsedFile struct {
	// Original file Info
	Info *repository.FileInfo
	// Parsed contents
	Obj *unstructured.Unstructured
	// The Kind is defined in the file
	GVK *schema.GroupVersionKind
	// The Resource is found by mapping Kind to the right apiserver
	GVR *schema.GroupVersionResource
	// Client that can talk to this resource
	Client dynamic.ResourceInterface

	// The Existing object (same name)
	// ?? do we need/want the whole thing??
	Existing *unstructured.Unstructured

	// The results from dry run
	DryRunResponse *unstructured.Unstructured

	// If we got some Errors
	Errors []error
}

func (r *FileParser) Parse(ctx context.Context, logger *slog.Logger, info *repository.FileInfo, validate bool) (*ParsedFile, error) {
	obj, gvk, err := LoadYAMLOrJSON(bytes.NewBuffer(info.Data))
	if err != nil {
		logger.DebugContext(ctx, "failed to find GVK of the input data", "error", err)
		obj, gvk, err = FallbackResourceLoader(ctx, logger, info.Data)
		if err != nil {
			logger.DebugContext(ctx, "also failed to get GVK from fallback loader?", "error", err)
			return nil, err
		}
	}
	parsed := &ParsedFile{
		Info: info,
		Obj:  obj,
		GVK:  gvk,
	}

	// Validate the namespace
	if obj.GetNamespace() != "" && obj.GetNamespace() != r.client.GetNamespace() {
		parsed.Errors = append(parsed.Errors, ErrNamespaceMismatch)
	}
	obj.SetNamespace(r.client.GetNamespace())

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

	client := r.client.Resource(gvr)
	parsed.GVR = &gvr
	parsed.Client = client
	if !validate {
		return parsed, nil
	}

	// Dry run CREATE or UPDATE
	parsed.Existing, _ = parsed.Client.Get(ctx, obj.GetName(), metav1.GetOptions{})
	if parsed.Existing == nil {
		parsed.DryRunResponse, err = parsed.Client.Create(ctx, obj, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
	} else {
		parsed.DryRunResponse, err = parsed.Client.Update(ctx, obj, metav1.UpdateOptions{
			DryRun: []string{"All"},
		})
	}
	if err != nil {
		parsed.Errors = append(parsed.Errors, err)
	}
	return parsed, nil
}

func (f *ParsedFile) ToSaveBytes() ([]byte, error) {
	// TODO... should use the validated one?
	obj := f.Obj.Object
	delete(obj, "metadata")

	switch filepath.Ext(f.Info.Path) {
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

func (f *ParsedFile) AsResourceWrapper() *provisioning.ResourceWrapper {
	info := f.Info
	res := provisioning.ResourceObjects{}
	if f.Obj != nil {
		res.File = v0alpha1.Unstructured{Object: f.Obj.Object}
	}
	if f.Existing != nil {
		res.Store = v0alpha1.Unstructured{Object: f.Existing.Object}
	}
	if f.DryRunResponse != nil {
		res.DryRun = v0alpha1.Unstructured{Object: f.DryRunResponse.Object}
	}
	wrap := &provisioning.ResourceWrapper{
		Path:      info.Path,
		Ref:       info.Ref,
		Hash:      info.Hash,
		Timestamp: info.Modified,
		Resource:  res,
	}
	for _, err := range f.Errors {
		wrap.Errors = append(wrap.Errors, err.Error())
	}
	return wrap
}

package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"

	"gopkg.in/yaml.v3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

var (
	ErrNamespaceMismatch = errors.New("the file namespace does not match target namespace")
)

type ParserFactory struct {
	ClientFactory *ClientFactory
}

func (f *ParserFactory) GetParser(ctx context.Context, repo repository.Reader) (*Parser, error) {
	config := repo.Config()

	clients, err := f.ClientFactory.Clients(ctx, config.GetNamespace())
	if err != nil {
		return nil, err
	}

	urls, _ := repo.(repository.RepositoryWithURLs)
	return &Parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      config.Spec.Type,
			Title:     config.Spec.Title,
			Namespace: config.Namespace,
			Name:      config.Name,
		},
		urls:    urls,
		clients: clients,
	}, nil
}

type Parser struct {
	// The target repository
	repo provisioning.ResourceRepositoryInfo

	// for repositories that have URL support
	urls repository.RepositoryWithURLs

	// ResourceClients give access to k8s apis
	clients ResourceClients
}

type ParsedResource struct {
	// Original file Info
	Info *repository.FileInfo

	// The repository details
	Repo provisioning.ResourceRepositoryInfo

	// Resource URLs
	URLs *provisioning.ResourceURLs

	// Check for classic file types (dashboard.json, etc)
	Classic provisioning.ClassicFileType

	// Parsed contents
	Obj *unstructured.Unstructured
	// Metadata accessor for the file object
	Meta utils.GrafanaMetaAccessor

	// The Kind is defined in the file
	GVK *schema.GroupVersionKind
	// The Resource is found by mapping Kind to the right apiserver
	GVR *schema.GroupVersionResource
	// Client that can talk to this resource
	Client dynamic.ResourceInterface

	// The Existing object (same name)
	// ?? do we need/want the whole thing??
	Existing *unstructured.Unstructured

	// Create or Update
	Action provisioning.ResourceAction

	// The results from dry run
	DryRunResponse *unstructured.Unstructured

	// When the value has been saved in the grafana database
	Upsert *unstructured.Unstructured

	// If we got some Errors
	Errors []error
}

// FIXME: eliminate clients from parser (but be careful that we can use the same cache/resolved GVK+GVR)
func (r *Parser) Clients() ResourceClients {
	return r.clients
}

func (r *Parser) Parse(ctx context.Context, info *repository.FileInfo, validate bool) (parsed *ParsedResource, err error) {
	logger := logging.FromContext(ctx).With("path", info.Path, "validate", validate)
	parsed = &ParsedResource{
		Info: info,
		Repo: r.repo,
	}

	if err := IsPathSupported(info.Path); err != nil {
		return parsed, err
	}

	parsed.Obj, parsed.GVK, err = DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if err != nil {
		logger.Debug("failed to find GVK of the input data", "error", err)
		parsed.Obj, parsed.GVK, parsed.Classic, err = ReadClassicResource(ctx, info)
		if err != nil {
			logger.Debug("also failed to get GVK from fallback loader?", "error", err)
			return parsed, err
		}
	}

	if r.urls != nil {
		parsed.URLs, err = r.urls.ResourceURLs(ctx, info)
		if err != nil {
			logger.Debug("failed to load resource URLs", "error", err)
			return parsed, err
		}
	}

	// Remove the internal dashboard UID,version and id if they exist
	if parsed.GVK.Group == dashboard.GROUP && parsed.GVK.Kind == "Dashboard" {
		unstructured.RemoveNestedField(parsed.Obj.Object, "spec", "uid")
		unstructured.RemoveNestedField(parsed.Obj.Object, "spec", "version")
		unstructured.RemoveNestedField(parsed.Obj.Object, "spec", "id") // now managed as a label
	}

	parsed.Meta, err = utils.MetaAccessor(parsed.Obj)
	if err != nil {
		return nil, err
	}
	obj := parsed.Obj

	// Validate the namespace
	if obj.GetNamespace() != "" && obj.GetNamespace() != r.repo.Namespace {
		parsed.Errors = append(parsed.Errors, ErrNamespaceMismatch)
	}

	obj.SetNamespace(r.repo.Namespace)
	parsed.Meta.SetManagerProperties(utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: r.repo.Name,
	})
	parsed.Meta.SetSourceProperties(utils.SourceProperties{
		Path:     info.Path, // joinPathWithRef(info.Path, info.Ref),
		Checksum: info.Hash,
	})

	if obj.GetName() == "" && obj.GetGenerateName() == "" {
		parsed.Errors = append(parsed.Errors,
			field.Required(field.NewPath("name", "metadata", "name"),
				"An explicit name must be saved in the resource (or generateName)"))
	}

	// Calculate folder identifier from the file path
	if info.Path != "" {
		dirPath := safepath.Dir(info.Path)
		if dirPath != "" {
			parsed.Meta.SetFolder(ParseFolder(dirPath, r.repo.Name).ID)
		}
	}
	obj.SetUID("")             // clear identifiers
	obj.SetResourceVersion("") // clear identifiers

	// We can not do anything more if no kind is defined
	if parsed.GVK == nil {
		return parsed, nil
	}

	if r.clients == nil {
		return parsed, fmt.Errorf("no client configured")
	}

	client, gvr, err := r.clients.ForKind(*parsed.GVK)
	if err != nil {
		return nil, err // does not map to a resour e
	}

	parsed.GVR = &gvr
	parsed.Client = client
	if !validate {
		return parsed, nil
	}

	if parsed.Client == nil {
		parsed.Errors = append(parsed.Errors, fmt.Errorf("unable to find client"))
		return parsed, nil
	}

	// Dry run CREATE or UPDATE
	parsed.Existing, _ = parsed.Client.Get(ctx, obj.GetName(), metav1.GetOptions{})
	if parsed.Existing == nil {
		parsed.Action = provisioning.ResourceActionCreate
		parsed.DryRunResponse, err = parsed.Client.Create(ctx, obj, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
	} else {
		parsed.Action = provisioning.ResourceActionUpdate
		parsed.DryRunResponse, err = parsed.Client.Update(ctx, obj, metav1.UpdateOptions{
			DryRun: []string{"All"},
		})
	}

	// When the name is missing (and generateName is configured) use the value from DryRun
	if obj.GetName() == "" && parsed.DryRunResponse != nil {
		obj.SetName(parsed.DryRunResponse.GetName())
	}

	if err != nil {
		parsed.Errors = append(parsed.Errors, err)
	}
	return parsed, nil
}

func (f *ParsedResource) ToSaveBytes() ([]byte, error) {
	obj := f.Obj.DeepCopy().Object
	delete(obj, "status")
	name := f.Obj.GetName()
	if name == "" {
		delete(obj, "metadata")
	} else {
		obj["metadata"] = map[string]any{"name": name}
	}

	switch path.Ext(f.Info.Path) {
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

func (f *ParsedResource) AsResourceWrapper() *provisioning.ResourceWrapper {
	info := f.Info
	res := provisioning.ResourceObjects{
		Type: provisioning.ResourceType{
			Classic: f.Classic,
		},
		Action: f.Action,
	}

	if f.GVK != nil {
		res.Type.Group = f.GVK.Group
		res.Type.Version = f.GVK.Version
		res.Type.Kind = f.GVK.Kind
	}

	// The resource (GVR) is derived from the kind (GVK)
	if f.GVR != nil {
		res.Type.Resource = f.GVR.Resource
	}

	if f.Obj != nil {
		res.File = v0alpha1.Unstructured{Object: f.Obj.Object}
	}
	if f.Existing != nil {
		res.Existing = v0alpha1.Unstructured{Object: f.Existing.Object}
	}
	if f.Upsert != nil {
		res.Upsert = v0alpha1.Unstructured{Object: f.Upsert.Object}
	} else if f.DryRunResponse != nil {
		res.DryRun = v0alpha1.Unstructured{Object: f.DryRunResponse.Object}
	}
	wrap := &provisioning.ResourceWrapper{
		Path:       info.Path,
		Ref:        info.Ref,
		Hash:       info.Hash,
		Repository: f.Repo,
		URLs:       f.URLs,
		Timestamp:  info.Modified,
		Resource:   res,
	}
	for _, err := range f.Errors {
		wrap.Errors = append(wrap.Errors, err.Error())
	}
	return wrap
}

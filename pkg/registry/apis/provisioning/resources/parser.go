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
	clients *ResourceClients
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

// FIXME: eliminate clients from parser

func (r *Parser) Clients() *ResourceClients {
	return r.clients
}

func (r *Parser) Parse(ctx context.Context, info *repository.FileInfo) (parsed *ParsedResource, err error) {
	logger := logging.FromContext(ctx).With("path", info.Path)
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

	// Calculate name+folder from the file path
	if info.Path != "" {
		objName := FileNameFromHashedRepoPath(r.repo.Name, info.Path)
		if obj.GetName() == "" {
			obj.SetName(objName) // use the name saved in config
		}

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

	return parsed, nil
}

func (f *ParsedResource) DryRun(ctx context.Context) {
	// TODO: is this append errors strategy the best one?
	if f.Client == nil {
		f.Errors = append(f.Errors, fmt.Errorf("unable to find client"))
		return
	}

	var err error
	// Dry run CREATE or UPDATE
	f.Existing, _ = f.Client.Get(ctx, f.Obj.GetName(), metav1.GetOptions{})
	if f.Existing == nil {
		f.Action = provisioning.ResourceActionCreate
		f.DryRunResponse, err = f.Client.Create(ctx, f.Obj, metav1.CreateOptions{
			DryRun: []string{"All"},
		})
	} else {
		f.Action = provisioning.ResourceActionUpdate
		f.DryRunResponse, err = f.Client.Update(ctx, f.Obj, metav1.UpdateOptions{
			DryRun: []string{"All"},
		})
	}

	if err != nil {
		f.Errors = append(f.Errors, err)
	}
}

func (f *ParsedResource) ToSaveBytes() ([]byte, error) {
	// TODO? should we use the dryRun (validated) version?
	obj := make(map[string]any)
	for k, v := range f.Obj.Object {
		if k != "metadata" {
			obj[k] = v
		}
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

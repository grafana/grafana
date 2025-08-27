package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"path"

	"gopkg.in/yaml.v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/util"
)

// ParserFactory is a factory for creating parsers for a given repository
//
//go:generate mockery --name ParserFactory --structname MockParserFactory --inpackage --filename parser_factory_mock.go --with-expecter
type ParserFactory interface {
	GetParser(ctx context.Context, repo repository.Reader) (Parser, error)
}

// Parser is a parser for a given repository
//
//go:generate mockery --name Parser --structname MockParser --inpackage --filename parser_mock.go --with-expecter
type Parser interface {
	Parse(ctx context.Context, info *repository.FileInfo) (parsed *ParsedResource, err error)
}

type parserFactory struct {
	ClientFactory ClientFactory
}

func NewParserFactory(clientFactory ClientFactory) ParserFactory {
	return &parserFactory{clientFactory}
}

func (f *parserFactory) GetParser(ctx context.Context, repo repository.Reader) (Parser, error) {
	config := repo.Config()

	clients, err := f.ClientFactory.Clients(ctx, config.GetNamespace())
	if err != nil {
		return nil, err
	}

	urls, _ := repo.(repository.RepositoryWithURLs)
	return &parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      config.Spec.Type,
			Title:     config.Spec.Title,
			Namespace: config.Namespace,
			Name:      config.Name,
		},
		urls:    urls,
		clients: clients,
		config:  config,
	}, nil
}

type parser struct {
	// The target repository
	repo provisioning.ResourceRepositoryInfo

	// for repositories that have URL support
	urls repository.RepositoryWithURLs

	config *provisioning.Repository

	// ResourceClients give access to k8s apis
	clients ResourceClients
}

type ParsedResource struct {
	// Original file Info
	Info *repository.FileInfo

	// The repository details
	Repo provisioning.ResourceRepositoryInfo

	// Resource URLs
	URLs *provisioning.RepositoryURLs

	// Check for classic file types (dashboard.json, etc)
	Classic provisioning.ClassicFileType

	// Parsed contents
	Obj *unstructured.Unstructured
	// Metadata accessor for the file object
	Meta utils.GrafanaMetaAccessor

	// The Kind is defined in the file
	GVK schema.GroupVersionKind
	// The Resource is found by mapping Kind to the right apiserver
	GVR schema.GroupVersionResource
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
	Errors []string
}

func (r *parser) Parse(ctx context.Context, info *repository.FileInfo) (parsed *ParsedResource, err error) {
	logger := logging.FromContext(ctx).With("path", info.Path)
	parsed = &ParsedResource{
		Info: info,
		Repo: r.repo,
	}

	if err := IsPathSupported(info.Path); err != nil {
		return nil, err
	}

	var gvk *schema.GroupVersionKind
	parsed.Obj, gvk, err = DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if err != nil || gvk == nil {
		logger.Debug("failed to find GVK of the input data, trying fallback loader", "error", err)
		parsed.Obj, gvk, parsed.Classic, err = ReadClassicResource(ctx, info)
		if err != nil || gvk == nil {
			return nil, apierrors.NewBadRequest("unable to read file as a resource")
		}
	}

	parsed.GVK = *gvk

	if r.urls != nil {
		parsed.URLs, err = r.urls.ResourceURLs(ctx, info)
		if err != nil {
			return nil, fmt.Errorf("load resource URLs: %w", err)
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
		return nil, fmt.Errorf("get meta accessor: %w", err)
	}
	obj := parsed.Obj

	// Validate the namespace
	if obj.GetNamespace() != "" && obj.GetNamespace() != r.repo.Namespace {
		return nil, apierrors.NewBadRequest("the file namespace does not match target namespace")
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

	if obj.GetName() == "" {
		if obj.GetGenerateName() == "" {
			return nil, ErrMissingName
		}
		// Generate a new UID
		obj.SetName(obj.GetGenerateName() + util.GenerateShortUID())
	}

	// Calculate folder identifier from the file path
	if info.Path != "" {
		dirPath := safepath.Dir(info.Path)
		if dirPath != "" {
			parsed.Meta.SetFolder(ParseFolder(dirPath, r.repo.Name).ID)
		} else {
			parsed.Meta.SetFolder(RootFolder(r.config))
		}
	}
	obj.SetUID("")             // clear identifiers
	obj.SetResourceVersion("") // clear identifiers

	// FIXME: remove this check once we have better unit tests
	if r.clients == nil {
		return parsed, fmt.Errorf("no clients configured")
	}

	// TODO: catch the not found gvk error to return bad request
	parsed.Client, parsed.GVR, err = r.clients.ForKind(parsed.GVK)
	if err != nil {
		return nil, fmt.Errorf("get client for kind: %w", err)
	}

	return parsed, nil
}

func (f *ParsedResource) DryRun(ctx context.Context) error {
	if f.DryRunResponse != nil {
		return nil // this already ran (and helpful for testing)
	}

	// FIXME: remove this check once we have better unit tests
	if f.Client == nil {
		return fmt.Errorf("no client configured")
	}

	// Use the same identity that would eventually write the resource (via Run)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, f.Obj.GetNamespace())
	if err != nil {
		return err
	}

	fieldValidation := "Strict"
	if f.GVR == DashboardResource {
		fieldValidation = "Ignore" // FIXME: temporary while we improve validation
	}

	// Handle deletion action separately
	if f.Action == provisioning.ResourceActionDelete {
		// For delete, we need the existing resource to validate deletion
		f.Existing, err = f.Client.Get(ctx, f.Obj.GetName(), metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				// Resource doesn't exist, nothing to delete - this is fine for dry run
				return nil
			}
			return fmt.Errorf("failed to get existing resource for delete dry run: %w", err)
		}

		// Check for ownership conflicts
		requestingManager := utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: f.Repo.Name,
		}
		if err := CheckResourceOwnership(f.Existing, f.Obj.GetName(), requestingManager); err != nil {
			return err
		}

		// For delete dry run, we simulate the delete operation
		// The dry run response will be the existing resource that would be deleted
		f.DryRunResponse = f.Existing.DeepCopy()
		return nil
	}

	// FIXME: shouldn't we check for the specific error?
	// Dry run CREATE or UPDATE
	f.Existing, _ = f.Client.Get(ctx, f.Obj.GetName(), metav1.GetOptions{})

	// Check for ownership conflicts after fetching existing resource
	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: f.Repo.Name,
	}

	// Check for ownership conflicts after fetching existing resource
	if err := CheckResourceOwnership(f.Existing, f.Obj.GetName(), requestingManager); err != nil {
		return err
	}

	if f.Existing == nil {
		f.Action = provisioning.ResourceActionCreate
		f.DryRunResponse, err = f.Client.Create(ctx, f.Obj, metav1.CreateOptions{
			DryRun:          []string{"All"},
			FieldValidation: fieldValidation,
		})
	} else {
		f.Action = provisioning.ResourceActionUpdate
		f.DryRunResponse, err = f.Client.Update(ctx, f.Obj, metav1.UpdateOptions{
			DryRun:          []string{"All"},
			FieldValidation: fieldValidation,
		})
	}
	return err
}

func (f *ParsedResource) Run(ctx context.Context) error {
	// FIXME: remove this check once we have better unit tests
	if f.Client == nil {
		return fmt.Errorf("unable to find client")
	}

	// Always use the provisioning identity when writing
	ctx, _, err := identity.WithProvisioningIdentity(ctx, f.Obj.GetNamespace())
	if err != nil {
		return err
	}

	fieldValidation := "Strict"
	if f.GVR == DashboardResource {
		fieldValidation = "Ignore" // FIXME: temporary while we improve validation
	}

	// Check for ownership conflicts
	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: f.Repo.Name,
	}

	// Handle deletion action
	if f.Action == provisioning.ResourceActionDelete {
		// If we don't have existing resource from DryRun, fetch it now
		if f.DryRunResponse == nil {
			f.Existing, err = f.Client.Get(ctx, f.Obj.GetName(), metav1.GetOptions{})
			if err != nil {
				if apierrors.IsNotFound(err) {
					// Resource doesn't exist, nothing to delete - this is fine
					return nil
				}
				return fmt.Errorf("failed to get existing resource for delete: %w", err)
			}
		}

		// Check ownership with the existing resource
		if err := CheckResourceOwnership(f.Existing, f.Obj.GetName(), requestingManager); err != nil {
			return err
		}

		// Perform the actual delete
		err = f.Client.Delete(ctx, f.Obj.GetName(), metav1.DeleteOptions{})
		if apierrors.IsNotFound(err) {
			err = nil // ignorable - resource was already deleted
		}

		// Set the deleted resource as the result
		if err == nil && f.Existing != nil {
			f.Upsert = f.Existing.DeepCopy()
		}

		return err
	}

	// If we don't have existing resource from DryRun, fetch it now
	if f.DryRunResponse == nil {
		f.Existing, _ = f.Client.Get(ctx, f.Obj.GetName(), metav1.GetOptions{})
	}

	// Check ownership with the existing resource (if any)
	if err := CheckResourceOwnership(f.Existing, f.Obj.GetName(), requestingManager); err != nil {
		return err
	}

	// If we have already tried loading existing, start with create
	if f.DryRunResponse != nil && f.Existing == nil {
		f.Action = provisioning.ResourceActionCreate
		f.Upsert, err = f.Client.Create(ctx, f.Obj, metav1.CreateOptions{
			FieldValidation: fieldValidation,
		})
		if err == nil {
			return nil // it worked, return
		}
	}

	// Try update, otherwise create
	f.Action = provisioning.ResourceActionUpdate
	f.Upsert, err = f.Client.Update(ctx, f.Obj, metav1.UpdateOptions{
		FieldValidation: fieldValidation,
	})
	if apierrors.IsNotFound(err) {
		f.Action = provisioning.ResourceActionCreate
		f.Upsert, err = f.Client.Create(ctx, f.Obj, metav1.CreateOptions{
			FieldValidation: fieldValidation,
		})
	}
	return err
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

	res.Type.Group = f.GVK.Group
	res.Type.Version = f.GVK.Version
	res.Type.Kind = f.GVK.Kind
	res.Type.Resource = f.GVR.Resource

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
		Errors:     f.Errors,
	}

	return wrap
}

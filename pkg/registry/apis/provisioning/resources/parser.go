package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"

	"go.opentelemetry.io/otel/attribute"
	"go.yaml.in/yaml/v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	ClientFactory         ClientFactory
	folderMetadataEnabled bool
}

func NewParserFactory(clientFactory ClientFactory, folderMetadataEnabled bool) ParserFactory {
	return &parserFactory{clientFactory, folderMetadataEnabled}
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
		reader:                repo,
		urls:                  urls,
		clients:               clients,
		config:                config,
		folderMetadataEnabled: f.folderMetadataEnabled,
	}, nil
}

type parser struct {
	// The target repository
	repo provisioning.ResourceRepositoryInfo

	// reader allows reading files from the repository (e.g. _folder.json for parent UID lookup)
	reader repository.Reader

	// for repositories that have URL support
	urls repository.RepositoryWithURLs

	config *provisioning.Repository

	// ResourceClients give access to k8s apis
	clients ResourceClients

	folderMetadataEnabled bool
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

	// SkipStrictValidation requests FieldValidation=Ignore on the apiserver
	// write. Used by in-place renames so that a path/folder change cannot be
	// blocked by strict schema validation of an unchanged spec — a dashboard
	// that already lives in the cluster (e.g. saved before stricter CUE
	// schemas were enforced) must remain renameable.
	SkipStrictValidation bool

	// The results from dry run
	DryRunResponse *unstructured.Unstructured

	// When the value has been saved in the grafana database
	Upsert *unstructured.Unstructured

	// If we got some Errors
	Errors []string
}

func (r *parser) Parse(ctx context.Context, info *repository.FileInfo) (parsed *ParsedResource, err error) {
	parsed = &ParsedResource{
		Info: info,
		Repo: r.repo,
	}

	if err := IsPathSupported(info.Path); err != nil {
		return nil, NewResourceValidationError(err)
	}

	var gvk *schema.GroupVersionKind
	parsed.Obj, gvk, parsed.Classic, err = ParseFileResource(ctx, info)
	if err != nil {
		return nil, err
	}

	parsed.GVK = *gvk

	if r.urls != nil {
		parsed.URLs, err = r.urls.ResourceURLs(ctx, info)
		if err != nil {
			return nil, fmt.Errorf("load resource URLs: %w", err)
		}
	}

	if parsed.GVK.Group == folder.GROUP && parsed.GVK.Kind == folder.FolderResourceInfo.GroupVersionKind().Kind {
		// _folder.json is a system-managed folder manifest written by the provisioning
		// layer when the provisioningFolderMetadata flag is on. It is the only folder-typed
		// file allowed through the files endpoint (e.g. for GET requests).
		if !r.folderMetadataEnabled || !IsFolderMetadataFile(info.Path) {
			return nil, NewResourceValidationError(errors.New("cannot declare folders through files"))
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
		return nil, NewResourceValidationError(fmt.Errorf("the file namespace does not match target namespace"))
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
			return nil, NewResourceValidationError(ErrMissingName)
		}
		// Generate a new UID
		obj.SetName(obj.GetGenerateName() + util.GenerateShortUID())
	}

	// Calculate folder identifier from the file path
	if info.Path != "" {
		dirPath := safepath.Dir(info.Path)
		// _folder.json represents the directory it lives in, so its parent is one level above.
		if r.folderMetadataEnabled && IsFolderMetadataFile(info.Path) {
			dirPath = safepath.Dir(dirPath)
		}
		if dirPath != "" {
			folderID := ParseFolder(dirPath, r.repo.Name).ID
			// When folder metadata is enabled and the parent folder has a _folder.json,
			// use the stable UID from that file instead of the hash-derived one.
			if r.folderMetadataEnabled && r.reader != nil {
				if meta, _, err := ReadFolderMetadata(ctx, r.reader, dirPath, info.Ref); err == nil && meta.Name != "" {
					folderID = meta.Name
				}
			}
			parsed.Meta.SetFolder(folderID)
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
	parsed.Client, parsed.GVR, err = r.clients.ForKind(ctx, parsed.GVK)
	if err != nil {
		return nil, NewResourceValidationError(fmt.Errorf("get client for kind: %w", err))
	}

	return parsed, nil
}

// SameIdentity reports whether f and other refer to the same Kubernetes
// resource: same metadata.name, API group, and kind.
func (f *ParsedResource) SameIdentity(other *ParsedResource) bool {
	if f == nil || other == nil {
		return false
	}
	return f.Obj.GetName() == other.Obj.GetName() &&
		f.GVK.Group == other.GVK.Group &&
		f.GVK.Kind == other.GVK.Kind
}

// ExistingFolder returns the grafana.app/folder annotation from the existing
// Grafana object, or "" if Existing is nil or has no folder annotation.
func (f *ParsedResource) ExistingFolder() string {
	if f.Existing == nil {
		return ""
	}
	meta, err := utils.MetaAccessor(f.Existing)
	if err != nil {
		return ""
	}
	return meta.GetFolder()
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
	if f.SkipStrictValidation || f.GVR == DashboardResource {
		fieldValidation = "Ignore" // FIXME: dashboard exemption is temporary while we improve validation
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
		if err := CheckResourceOwnership(ctx, f.Existing, f.Obj.GetName(), requestingManager); err != nil {
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
	if err := CheckResourceOwnership(ctx, f.Existing, f.Obj.GetName(), requestingManager); err != nil {
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
		// on updates, clear the deprecated internal id, it will be set to the previous value by the storage layer
		f.Meta.SetDeprecatedInternalID(0) // nolint:staticcheck
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
	identityCtx, _, err := identity.WithProvisioningIdentity(ctx, f.Obj.GetNamespace())
	ctx, identitySpan := tracing.Start(identityCtx, "provisioning.resources.run_resource.set_identity")

	if err != nil {
		identitySpan.RecordError(err)
		identitySpan.End()
		return err
	}
	identitySpan.End()

	fieldValidation := "Strict"
	if f.SkipStrictValidation || f.GVR == DashboardResource {
		fieldValidation = "Ignore" // FIXME: dashboard exemption is temporary while we improve validation
	}

	// Check for ownership conflicts
	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: f.Repo.Name,
	}

	actionsCtx, actionsSpan := tracing.Start(ctx, "provisioning.resources.run_resource.actions")
	defer actionsSpan.End()

	// Handle deletion action
	if f.Action == provisioning.ResourceActionDelete {
		deleteCtx, deleteSpan := tracing.Start(actionsCtx, "provisioning.resources.run_resource.delete")
		deleteSpan.SetAttributes(attribute.String("resource.name", f.Obj.GetName()))

		// If we don't have existing resource from DryRun, fetch it now
		if f.DryRunResponse == nil {
			f.Existing, err = f.Client.Get(deleteCtx, f.Obj.GetName(), metav1.GetOptions{})
			if err != nil {
				deleteSpan.RecordError(err)
				if apierrors.IsNotFound(err) {
					// Resource doesn't exist, nothing to delete - this is fine
					deleteSpan.End()
					return nil
				}
				deleteSpan.End()
				return fmt.Errorf("failed to get existing resource for delete: %w", err)
			}
		}

		// Check ownership with the existing resource
		if err := CheckResourceOwnership(ctx, f.Existing, f.Obj.GetName(), requestingManager); err != nil {
			deleteSpan.RecordError(err)
			deleteSpan.End()
			return err
		}

		// Perform the actual delete
		err = f.Client.Delete(deleteCtx, f.Obj.GetName(), metav1.DeleteOptions{})
		if apierrors.IsNotFound(err) {
			err = nil // ignorable - resource was already deleted
		}
		if err != nil {
			deleteSpan.RecordError(err)
		}

		// Set the deleted resource as the result
		if err == nil && f.Existing != nil {
			f.Upsert = f.Existing.DeepCopy()
		}

		deleteSpan.End()
		return err
	}

	// If we don't have existing resource from DryRun, fetch it now
	if f.DryRunResponse == nil {
		f.Existing, _ = f.Client.Get(actionsCtx, f.Obj.GetName(), metav1.GetOptions{})
	}

	// Check ownership with the existing resource (if any)
	if err := CheckResourceOwnership(ctx, f.Existing, f.Obj.GetName(), requestingManager); err != nil {
		return err
	}

	// If we have already tried loading existing, start with create
	if f.DryRunResponse != nil && f.Existing == nil {
		f.Action = provisioning.ResourceActionCreate
		createCtx, createSpan := tracing.Start(actionsCtx, "provisioning.resources.run_resource.create")
		createSpan.SetAttributes(attribute.String("resource.name", f.Obj.GetName()))
		f.Upsert, err = f.Client.Create(createCtx, f.Obj, metav1.CreateOptions{
			FieldValidation: fieldValidation,
		})
		if err != nil {
			createSpan.RecordError(err)
		}
		createSpan.End()

		if err == nil {
			return nil // it worked, return
		}
	}

	// Try update, otherwise create
	f.Action = provisioning.ResourceActionUpdate

	// on updates, clear the deprecated internal id, it will be set to the previous value by the storage layer
	if f.Existing != nil {
		f.Meta.SetDeprecatedInternalID(0) // nolint:staticcheck
	}

	updateCtx, updateSpan := tracing.Start(actionsCtx, "provisioning.resources.run_resource.update")
	updateSpan.SetAttributes(attribute.String("resource.name", f.Obj.GetName()))
	f.Upsert, err = f.Client.Update(updateCtx, f.Obj, metav1.UpdateOptions{
		FieldValidation: fieldValidation,
	})
	if err != nil {
		updateSpan.RecordError(err)
	}
	updateSpan.End()

	if apierrors.IsNotFound(err) {
		f.Action = provisioning.ResourceActionCreate
		fallbackCreateCtx, fallbackCreateSpan := tracing.Start(actionsCtx, "provisioning.resources.run_resource.create_fallback")
		fallbackCreateSpan.SetAttributes(attribute.String("resource.name", f.Obj.GetName()))
		f.Upsert, err = f.Client.Create(fallbackCreateCtx, f.Obj, metav1.CreateOptions{
			FieldValidation: fieldValidation,
		})
		if err != nil {
			fallbackCreateSpan.RecordError(err)
		}
		fallbackCreateSpan.End()
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

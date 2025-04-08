package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

var (
	ErrAlreadyInRepository = errors.New("already in repository")
	ErrMissingName         = field.Required(field.NewPath("name", "metadata", "name"), "missing name in resource")
)

type WriteOptions struct {
	Path string
	Ref  string
}

type resourceID struct {
	Name     string
	Resource string
	Group    string
}

type ResourcesManager struct {
	repo            repository.ReaderWriter
	folders         *FolderManager
	parser          Parser
	clients         ResourceClients
	userInfo        map[string]repository.CommitSignature
	resourcesLookup map[resourceID]string // the path with this k8s name
}

func NewResourcesManager(repo repository.ReaderWriter, folders *FolderManager, parser Parser, clients ResourceClients, userInfo map[string]repository.CommitSignature) *ResourcesManager {
	return &ResourcesManager{
		repo:            repo,
		folders:         folders,
		parser:          parser,
		clients:         clients,
		userInfo:        userInfo,
		resourcesLookup: map[resourceID]string{},
	}
}

// CreateResource writes an object to the repository
func (r *ResourcesManager) CreateResourceFileFromObject(ctx context.Context, obj *unstructured.Unstructured, options WriteOptions) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", fmt.Errorf("context error: %w", err)
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return "", fmt.Errorf("extract meta accessor: %w", err)
	}

	// Message from annotations
	commitMessage := meta.GetMessage()
	if commitMessage == "" {
		g := meta.GetGeneration()
		if g > 0 {
			commitMessage = fmt.Sprintf("Generation: %d", g)
		} else {
			commitMessage = "exported from grafana"
		}
	}

	ctx = r.withAuthorSignature(ctx, meta)

	name := meta.GetName()
	if name == "" {
		return "", ErrMissingName
	}

	manager, _ := meta.GetManagerProperties()
	// TODO: how we should handle this?
	if manager.Identity == r.repo.Config().GetName() {
		// If it's already in the repository, we don't need to write it
		return "", ErrAlreadyInRepository
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Get the absolute path of the folder
	fid, ok := r.folders.Tree().DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		// r.logger.Error("folder of item was not in tree of repository")
	}

	// Clear the metadata
	delete(obj.Object, "metadata")

	// Always write the identifier
	meta.SetName(name)

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal dashboard: %w", err)
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName = safepath.Join(fid.Path, fileName)
	}
	if options.Path != "" {
		fileName = safepath.Join(options.Path, fileName)
	}

	err = r.repo.Write(ctx, fileName, options.Ref, body, commitMessage)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fileName, nil
}

func (r *ResourcesManager) WriteResourceFromFile(ctx context.Context, path string, ref string) (string, schema.GroupVersionKind, error) {
	// Read the referenced file
	fileInfo, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to read file: %w", err)
	}

	parsed, err := r.parser.Parse(ctx, fileInfo)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to parse file: %w", err)
	}

	if parsed.Obj.GetName() == "" {
		return "", schema.GroupVersionKind{}, ErrMissingName
	}

	// Check if the resource already exists
	id := resourceID{
		Name:     parsed.Obj.GetName(),
		Resource: parsed.GVR.Resource,
		Group:    parsed.GVK.Group,
	}
	existing, found := r.resourcesLookup[id]
	if found {
		return "", parsed.GVK, fmt.Errorf("duplicate resource name: %s, %s and %s", parsed.Obj.GetName(), path, existing)
	}
	r.resourcesLookup[id] = path

	// For resources that exist in folders, set the header annotation
	if slices.Contains(SupportsFolderAnnotation, parsed.GVR.GroupResource()) {
		// Make sure the parent folders exist
		folder, err := r.folders.EnsureFolderPathExist(ctx, path)
		if err != nil {
			return "", parsed.GVK, fmt.Errorf("failed to ensure folder path exists: %w", err)
		}
		parsed.Meta.SetFolder(folder)
	}

	// Clear any saved identifiers
	parsed.Meta.SetUID("")
	parsed.Meta.SetResourceVersion("")

	// Update or Create resource
	parsed.Upsert, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
	if apierrors.IsNotFound(err) {
		parsed.Upsert, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
	}

	return parsed.Obj.GetName(), parsed.GVK, err
}

func (r *ResourcesManager) RenameResourceFile(ctx context.Context, previousPath, previousRef, newPath, newRef string) (string, schema.GroupVersionKind, error) {
	name, gvk, err := r.RemoveResourceFromFile(ctx, previousPath, previousRef)
	if err != nil {
		return name, gvk, fmt.Errorf("failed to remove resource: %w", err)
	}

	return r.WriteResourceFromFile(ctx, newPath, newRef)
}

func (r *ResourcesManager) RemoveResourceFromFile(ctx context.Context, path string, ref string) (string, schema.GroupVersionKind, error) {
	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to read file: %w", err)
	}

	obj, gvk, _ := DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if obj == nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("no object found")
	}

	objName := obj.GetName()
	if objName == "" {
		return "", schema.GroupVersionKind{}, ErrMissingName
	}

	client, _, err := r.clients.ForKind(*gvk)
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("unable to get client for deleted object: %w", err)
	}

	err = client.Delete(ctx, objName, metav1.DeleteOptions{})
	if err != nil {
		return "", schema.GroupVersionKind{}, fmt.Errorf("failed to delete: %w", err)
	}

	return objName, schema.GroupVersionKind{}, nil
}

func (r *ResourcesManager) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := r.userInfo[id] // lookup
	if sig.Name == "" && sig.Email == "" {
		sig.Name = id
	}
	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}

	return repository.WithAuthorSignature(ctx, sig)
}

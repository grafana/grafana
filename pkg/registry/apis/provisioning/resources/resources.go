package resources

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var ErrAlreadyInRepository = errors.New("already in repository")

type WriteOptions struct {
	Identifier bool
	Path       string
	Ref        string
}

type ResourcesManager struct {
	repo     repository.ReaderWriter
	folders  *FolderManager
	clients  *ResourceClients
	userInfo map[string]repository.CommitSignature
}

func NewResourcesManager(repo repository.ReaderWriter, folders *FolderManager, clients *ResourceClients, userInfo map[string]repository.CommitSignature) *ResourcesManager {
	return &ResourcesManager{
		repo:     repo,
		folders:  folders,
		clients:  clients,
		userInfo: userInfo,
	}
}

// CreateResource writes an object to the repository
func (m *ResourcesManager) CreateResourceFromObject(ctx context.Context, obj *unstructured.Unstructured, options WriteOptions) (string, error) {
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

	ctx = m.withAuthorSignature(ctx, meta)

	name := meta.GetName()
	manager, _ := meta.GetManagerProperties()
	// TODO: how we should handle this?
	if manager.Identity == m.repo.Config().GetName() {
		// If it's already in the repository, we don't need to write it
		return "", ErrAlreadyInRepository
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Get the absolute path of the folder
	fid, ok := m.folders.Tree().DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		// r.logger.Error("folder of item was not in tree of repository")
	}

	// Clear the metadata
	delete(obj.Object, "metadata")

	if options.Identifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

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

	err = m.repo.Write(ctx, fileName, options.Ref, body, commitMessage)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fileName, nil
}

func (r *ResourcesManager) DeleteObject(ctx context.Context, path string, ref string) (string, *schema.GroupVersionKind, error) {
	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", nil, fmt.Errorf("failed to read file: %w", err)
	}

	obj, gvk, _ := DecodeYAMLObject(bytes.NewBuffer(info.Data))
	if obj == nil {
		return "", nil, fmt.Errorf("no object found")
	}

	objName := obj.GetName()
	if objName == "" {
		// Find the referenced file
		objName, _ = NamesFromHashedRepoPath(r.repo.Config().Name, path)
	}

	client, _, err := r.clients.ForKind(*gvk)
	if err != nil {
		return "", nil, fmt.Errorf("unable to get client for deleted object: %w", err)
	}

	err = client.Delete(ctx, objName, metav1.DeleteOptions{})
	if err != nil {
		return "", nil, fmt.Errorf("failed to delete: %w", err)
	}

	return objName, gvk, nil
}

func (m *ResourcesManager) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := m.userInfo[id] // lookup
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

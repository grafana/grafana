package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"path"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type Replicator struct {
	logger     *slog.Logger
	client     *DynamicClient
	parser     *Parser
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewReplicator(
	repo repository.Repository,
	parser *Parser,
	logger *slog.Logger,
) (*Replicator, error) {
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	return &Replicator{
		logger:     logger,
		parser:     parser,
		client:     dynamicClient,
		folders:    folders,
		repository: repo,
	}, nil
}

// Sync replicates all files in the repository.
func (r *Replicator) Sync(ctx context.Context) error {
	// FIXME: how to handle the scenario in which folder changes?
	cfg := r.repository.Config()
	lastCommit := cfg.Status.Sync.Hash
	versionedRepo, isVersioned := r.repository.(repository.VersionedRepository)

	// started := time.Now()

	if err := r.ensureRepositoryFolderExists(ctx); err != nil {
		return fmt.Errorf("ensure repository folder exists: %w", err)
	}

	var latest string
	switch {
	case !isVersioned:
		r.logger.InfoContext(ctx, "replicate tree unversioned repository")
		if err := r.replicateTree(ctx, ""); err != nil {
			return fmt.Errorf("replicate tree: %w", err)
		}
	case lastCommit == "":
		var err error
		latest, err = versionedRepo.LatestRef(ctx, r.logger)
		if err != nil {
			return fmt.Errorf("latest ref: %w", err)
		}
		if err := r.replicateTree(ctx, latest); err != nil {
			return fmt.Errorf("replicate tree: %w", err)
		}
		r.logger.InfoContext(ctx, "initial replication for versioned repository", "latest", latest)
	default:
		var err error
		latest, err = versionedRepo.LatestRef(ctx, r.logger)
		if err != nil {
			return fmt.Errorf("latest ref: %w", err)
		}

		r.logger.InfoContext(ctx, "replicate changes for versioned repository", "last_commit", lastCommit, "latest", latest)
		changes, err := versionedRepo.CompareFiles(ctx, r.logger, lastCommit, latest)
		if err != nil {
			return fmt.Errorf("compare files: %w", err)
		}

		if err := r.replicateChanges(ctx, changes); err != nil {
			return fmt.Errorf("replicate changes: %w", err)
		}
	}

	// TODO: move the sync status to the job worker
	status := &provisioning.SyncStatus{
		// FIXME: these create infinite loop
		// Started:  started.Unix(),
		// Finished: time.Now().Unix(),
		Hash: latest,
	}

	cfg.Status.Sync = *status

	// TODO: Can we use typed client for this?
	client := r.client.Resource(provisioning.RepositoryResourceInfo.GroupVersionResource())
	unstructuredResource := &unstructured.Unstructured{}
	jj, _ := json.Marshal(cfg)
	err := json.Unmarshal(jj, &unstructuredResource.Object)
	if err != nil {
		return fmt.Errorf("error loading config json: %w", err)
	}

	if _, err := client.UpdateStatus(ctx, unstructuredResource, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update repository status: %w", err)
	}

	return nil
}

// replicateTree replicates all files in the repository.
func (r *Replicator) replicateTree(ctx context.Context, ref string) error {
	logger := r.logger
	tree, err := r.repository.ReadTree(ctx, logger, ref)
	if err != nil {
		return fmt.Errorf("read tree: %w", err)
	}

	for _, entry := range tree {
		logger := logger.With("file", entry.Path)
		if !entry.Blob {
			logger.DebugContext(ctx, "ignoring non-blob entry")
			continue
		}

		if r.parser.ShouldIgnore(ctx, logger, entry.Path) {
			logger.DebugContext(ctx, "ignoring file")
			continue
		}

		info, err := r.repository.Read(ctx, logger, entry.Path, ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		// The parse function will fill in the repository metadata, so copy it over here
		info.Hash = entry.Hash
		info.Modified = nil // modified?

		if err := r.replicateFile(ctx, info); err != nil {
			if errors.Is(err, ErrUnableToReadResourceBytes) {
				logger.InfoContext(ctx, "file does not contain a resource")
				continue
			}
			return fmt.Errorf("replicate file: %w", err)
		}
	}

	return nil
}

// replicateFile creates a new resource in the cluster.
// If the resource already exists, it will be updated.
func (r *Replicator) replicateFile(ctx context.Context, fileInfo *repository.FileInfo) error {
	logger := r.logger.With("file", fileInfo.Path, "ref", fileInfo.Ref)
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}
	logger = logger.With("action", file.Action, "name", file.Obj.GetName(), "file_namespace", file.Obj.GetNamespace(), "namespace", r.client.GetNamespace())

	parent, err := r.createFolderPath(ctx, fileInfo.Path)
	if err != nil {
		return fmt.Errorf("failed to create folder path: %w", err)
	}
	logger = logger.With("folder", parent)

	if parent != "" {
		file.Meta.SetFolder(parent)
	}

	if file.Action == provisioning.ResourceActionCreate {
		_, err := file.Client.Create(ctx, file.Obj, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create object: %w", err)
		}
	} else if file.Action == provisioning.ResourceActionUpdate {
		existingMeta, err := apiutils.MetaAccessor(file.Existing)
		if err != nil {
			return fmt.Errorf("failed to create meta accessor for the existing object: %w", err)
		}

		// Just in case no uid is present on the metadata for some reason.
		logger := logger.With("previous_uid", file.Meta.GetUID(), "previous_resource_version", existingMeta.GetResourceVersion())
		if uid, ok, _ := unstructured.NestedString(file.Existing.Object, "spec", "uid"); ok {
			logger.DebugContext(ctx, "updating file's UID with spec.uid", "uid", uid)
			file.Meta.SetUID(types.UID(uid))
		}
		if uid := existingMeta.GetUID(); uid != "" {
			logger.DebugContext(ctx, "updating file's UID with existing meta uid", "uid", uid)
			file.Meta.SetUID(uid)
		}
		if rev := existingMeta.GetResourceVersion(); rev != "" {
			logger.DebugContext(ctx, "updating file's UID with existing resource version", "version", rev)
			file.Meta.SetResourceVersion(rev)
		}
		if gen := existingMeta.GetGeneration(); gen != 0 {
			logger.DebugContext(ctx, "updating file's UID with existing generation + 1", "generation", gen, "new_generation", gen+1)
			file.Meta.SetGeneration(gen + 1)
		}

		_, err = file.Client.Update(ctx, file.Obj, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update object: %w", err)
		}
	} else {
		logger.ErrorContext(ctx, "bug in Grafana: the file's action is unhandled")
		return fmt.Errorf("bug in Grafana: got a file.Action of '%s', which is not defined to be handled", file.Action)
	}

	logger.InfoContext(ctx, "Replicated file")

	return nil
}

func (r *Replicator) createFolderPath(ctx context.Context, filePath string) (string, error) {
	dir := path.Dir(filePath)
	parent := r.repository.Config().Spec.Folder
	if dir == "." || dir == "/" {
		return parent, nil
	}

	logger := r.logger.With("file", filePath)
	for _, folder := range strings.Split(dir, "/") {
		if folder == "" {
			// Trailing / leading slash?
			continue
		}

		logger := logger.With("folder", folder)
		obj, err := r.folders.Get(ctx, folder, metav1.GetOptions{})
		// FIXME: Check for IsNotFound properly
		if obj != nil || err == nil {
			logger.DebugContext(ctx, "folder already existed")
			parent = folder
			continue
		}

		_, err = r.folders.Create(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      folder,
					"namespace": r.client.GetNamespace(),
					"annotations": map[string]any{
						apiutils.AnnoKeyFolder: parent,
					},
				},
				"spec": map[string]any{
					"title":       folder, // TODO: how do we want to get this?
					"description": "Repository-managed folder.",
				},
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return parent, fmt.Errorf("failed to create folder '%s': %w", folder, err)
		}

		parent = folder
		logger.InfoContext(ctx, "folder created")
	}

	return parent, nil
}

func (r *Replicator) replicateChanges(ctx context.Context, changes []repository.FileChange) error {
	for _, change := range changes {
		if r.parser.ShouldIgnore(ctx, r.logger, change.Path) {
			continue
		}

		fileInfo, err := r.repository.Read(ctx, r.logger, change.Path, change.Ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			if err := r.replicateFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("replicate file: %w", err)
			}
		case repository.FileActionRenamed:
			// delete in old path
			oldPath, err := r.repository.Read(ctx, r.logger, change.PreviousPath, change.Ref)
			if err != nil {
				return fmt.Errorf("read previous path: %w", err)
			}
			if err := r.deleteFile(ctx, oldPath); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}

			if err := r.replicateFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("replicate file in new path: %w", err)
			}
		case repository.FileActionDeleted:
			if err := r.deleteFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}
		}
	}

	return nil
}

func (r *Replicator) deleteFile(ctx context.Context, fileInfo *repository.FileInfo) error {
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}

	_, err = file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if err != nil { // IsNotFound
		return fmt.Errorf("get object to delete: %w", err)
	}

	if err = file.Client.Delete(ctx, file.Obj.GetName(), metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	// TODO: delete folders if empty recursively

	r.logger.InfoContext(ctx, "Deleted file", "name", file.Obj.GetName(), "path", fileInfo.Path)

	return nil
}

func (r *Replicator) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*ParsedResource, error) {
	file, err := r.parser.Parse(ctx, r.logger, fileInfo, true)
	if err != nil {
		return nil, fmt.Errorf("failed to parse file %s: %w", fileInfo.Path, err)
	}

	if file.GVR == nil {
		return nil, errors.New("parsed file is missing GVR")
	}

	if file.Client == nil {
		return nil, errors.New("parsed file is missing client")
	}

	return file, nil
}

func (r *Replicator) Export(ctx context.Context) error {
	logger := r.logger
	dashboardIface := r.client.Resource(schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v2alpha1",
		Resource: "dashboards",
	})

	// TODO: handle pagination
	folders, err := r.fetchRepoFolderTree(ctx)
	if err != nil {
		return fmt.Errorf("failed to list folders: %w", err)
	}

	// TODO: handle pagination
	dashboardList, err := dashboardIface.List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list dashboards: %w", err)
	}

	for _, item := range dashboardList.Items {
		if ctx.Err() != nil {
			logger.DebugContext(ctx, "cancelling replication process due to ctx error", "error", err)
			return ctx.Err()
		}

		name := item.GetName()
		logger := logger.With("item", name)
		ns := r.repository.Config().GetNamespace()
		if item.GetNamespace() != ns {
			logger.DebugContext(ctx, "skipping dashboard item due to mismatching namespace", "got", ns)
			continue
		}

		folder := item.GetAnnotations()[apiutils.AnnoKeyFolder]
		logger = logger.With("folder", folder)
		if !folders.In(folder) {
			logger.DebugContext(ctx, "folder of item was not in tree of repository")
			continue
		}

		delete(item.Object, "metadata")
		marshalledBody, baseFileName, err := r.marshalPreferredFormat(item.Object, name, r.repository)
		if err != nil {
			return fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
		}
		fileName := filepath.Join(folders.DirPath(folder), baseFileName)
		logger = logger.With("file_name", fileName)
		if logger.Enabled(ctx, slog.LevelDebug) {
			bodyStr := string(marshalledBody)
			logger.DebugContext(ctx, "got marshalled body for item", "body", bodyStr)
		}

		var ref string
		if r.repository.Config().Spec.Type == provisioning.GitHubRepositoryType {
			ref = r.repository.Config().Spec.GitHub.Branch
		}
		logger = logger.With("ref", ref)

		_, err = r.repository.Read(ctx, r.logger, fileName, ref)
		if err != nil && !(errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err)) {
			logger.ErrorContext(ctx, "failed to check if file exists before writing", "error", err)
			return fmt.Errorf("failed to check if file exists before writing: %w", err)
		} else if err != nil { // ErrFileNotFound
			err = r.repository.Create(ctx, r.logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
		} else {
			err = r.repository.Update(ctx, r.logger, fileName, ref, marshalledBody, "export of dashboard "+name+" in namespace "+ns)
		}
		if err != nil {
			logger.ErrorContext(ctx, "failed to write a file in repository", "error", err)
			return fmt.Errorf("failed to write file in repo: %w", err)
		}
		logger.DebugContext(ctx, "successfully exported item")
	}

	return nil
}

type folderTree struct {
	tree       map[string]string
	repoFolder string
}

func (t *folderTree) In(folder string) bool {
	_, ok := t.tree[folder]
	return ok
}

// DirPath creates the path to the directory with slashes.
// The repository folder is not included in the path.
// If In(folder) is false, this will panic, because it would be undefined behaviour.
func (t *folderTree) DirPath(folder string) string {
	if folder == t.repoFolder {
		return ""
	}
	if !t.In(folder) {
		panic("undefined behaviour")
	}

	dirPath := folder
	parent := t.tree[folder]
	for parent != "" && parent != t.repoFolder {
		dirPath = path.Join(parent, dirPath)
		parent = t.tree[parent]
	}
	// Not using Clean here is intentional. We don't want `.` or similar.
	return dirPath
}

func (r *Replicator) fetchRepoFolderTree(ctx context.Context) (*folderTree, error) {
	iface := r.client.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	// TODO: handle pagination
	rawFolders, err := iface.List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	folders := make(map[string]string, len(rawFolders.Items))
	for _, rf := range rawFolders.Items {
		name := rf.GetName()
		// TODO: Can I use MetaAccessor here?
		parent := rf.GetAnnotations()[apiutils.AnnoKeyFolder]
		folders[name] = parent
	}

	// folders now includes a map[folder name]parent name
	// The top-most folder has a parent of "". Any folders below have parent refs.
	// We want to find only folders which are or start in repoFolder.
	repoFolder := r.repository.Config().Spec.Folder
	for folder, parent := range folders {
		if folder == repoFolder {
			continue
		}

		hasRepoRoot := false
		for parent != "" {
			if parent == repoFolder {
				hasRepoRoot = true
				break
			}
			parent = folders[parent]
		}
		if !hasRepoRoot {
			delete(folders, folder)
		}
	}

	// folders now only includes the tree of the repoFolder.

	return &folderTree{
		tree:       folders,
		repoFolder: repoFolder,
	}, nil
}

func (r *Replicator) ensureRepositoryFolderExists(ctx context.Context) error {
	_, err := r.folders.Get(ctx, r.repository.Config().Spec.Folder, metav1.GetOptions{})
	if err == nil {
		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if folder exists: %w", err)
	}

	cfg := r.repository.Config()
	title := cfg.Spec.Title
	if title == "" {
		title = cfg.Spec.Folder
	}

	if _, err := r.folders.Create(ctx, &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name":      cfg.Spec.Folder,
				"namespace": cfg.GetNamespace(),
			},
			"spec": map[string]any{
				"title":       title,
				"description": "Repository-managed folder",
			},
		},
	}, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	return nil
}

func (*Replicator) marshalPreferredFormat(obj any, name string, repo repository.Repository) (body []byte, fileName string, err error) {
	if repo.Config().Spec.PreferYAML {
		body, err = yaml.Marshal(obj)
		return body, name + ".yaml", err
	} else {
		body, err := json.MarshalIndent(obj, "", "    ")
		return body, name + ".json", err
	}
}

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
	"k8s.io/client-go/dynamic"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type ReplicatorFactory struct {
	repo    repository.Repository
	parsers *ParserFactory
	ignore  provisioning.IgnoreFile
	logger  *slog.Logger
}

func NewReplicatorFactory(repo repository.Repository, parsers *ParserFactory, ignore provisioning.IgnoreFile, logger *slog.Logger) *ReplicatorFactory {
	return &ReplicatorFactory{
		parsers: parsers,
		repo:    repo,
		ignore:  ignore,
		logger:  logger,
	}
}

func (f *ReplicatorFactory) New() (repository.FileReplicator, error) {
	// The replicator does not need a linter
	parser, err := f.parsers.GetParser(f.repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", f.repo.Config().Name, err)
	}
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	return &replicator{
		logger:     f.logger,
		parser:     parser,
		client:     dynamicClient,
		folders:    folders,
		repository: f.repo,
		ignore:     f.ignore,
	}, nil
}

type replicator struct {
	logger     *slog.Logger
	client     *DynamicClient
	parser     *Parser
	folders    dynamic.ResourceInterface
	repository repository.Repository
	ignore     provisioning.IgnoreFile
}

// Sync replicates all files in the repository.
func (r *replicator) Sync(ctx context.Context) error {
	cfg := r.repository.Config()
	lastCommit := cfg.Status.Sync.Hash
	versionedRepo, isVersioned := r.repository.(repository.VersionedRepository)

	var latest string
	if !isVersioned || lastCommit == "" {
		if err := r.ReplicateTree(ctx, ""); err != nil {
			return fmt.Errorf("replicate tree: %w", err)
		}
	} else {
		var err error
		latest, err = versionedRepo.LatestRef(ctx, r.logger)
		if err != nil {
			return fmt.Errorf("latest ref: %w", err)
		}

		changes, err := versionedRepo.CompareFiles(ctx, r.logger, latest)
		if err != nil {
			return fmt.Errorf("compare files: %w", err)
		}

		if err := r.ReplicateChanges(ctx, changes); err != nil {
			return fmt.Errorf("replicate changes: %w", err)
		}
	}

	status := &provisioning.SyncStatus{
		// TODO: rename to ref
		Hash: latest,
		// TODO: add timestamp
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

// ReplicateTree replicates all files in the repository.
func (r *replicator) ReplicateTree(ctx context.Context, ref string) error {
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

		if r.ignore(entry.Path) {
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

		if err := r.ReplicateFile(ctx, info); err != nil {
			if errors.Is(err, ErrUnableToReadResourceBytes) {
				logger.InfoContext(ctx, "file does not contain a resource")
				continue
			}
			return fmt.Errorf("replicate file: %w", err)
		}
	}

	return nil
}

// ReplicateFile creates a new resource in the cluster.
// If the resource already exists, it will be updated.
func (r *replicator) ReplicateFile(ctx context.Context, fileInfo *repository.FileInfo) error {
	file, err := r.parseResource(ctx, fileInfo)
	if err != nil {
		return err
	}

	parent, err := r.createFolderPath(ctx, fileInfo.Path)
	if err != nil {
		return fmt.Errorf("failed to create folder path: %w", err)
	}

	existing, err := file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if parent != "" {
		file.Meta.SetFolder(parent)
	}

	if err != nil { // IsNotFound
		_, err := file.Client.Create(ctx, file.Obj, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create object: %w", err)
		}
	} else { // already exists
		toWrite := file.Obj.DeepCopy()
		writeMeta, err := apiutils.MetaAccessor(toWrite)
		if err != nil {
			return fmt.Errorf("failed to create meta accessor for the object to write: %w", err)
		}

		existingMeta, err := apiutils.MetaAccessor(existing)
		if err != nil {
			return fmt.Errorf("failed to create meta accessor for the existing object: %w", err)
		}

		if uid := existingMeta.GetUID(); uid != "" {
			writeMeta.SetUID(uid)
		}
		if rev := existingMeta.GetResourceVersion(); rev != "" {
			writeMeta.SetResourceVersion(rev)
		}
		if gen := existingMeta.GetGeneration(); gen != 0 {
			writeMeta.SetGeneration(gen + 1)
		}

		_, err = file.Client.Update(ctx, toWrite, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update object: %w", err)
		}
	}

	r.logger.InfoContext(ctx, "Replicated file", "name", file.Obj.GetName(), "path", fileInfo.Path, "parent", parent)

	return nil
}

func (r *replicator) createFolderPath(ctx context.Context, filePath string) (string, error) {
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

func (r *replicator) ReplicateChanges(ctx context.Context, changes []repository.FileChange) error {
	for _, change := range changes {
		fileInfo, err := r.repository.Read(ctx, r.logger, change.Path, change.Ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			if err := r.ReplicateFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("replicate file: %w", err)
			}
		case repository.FileActionDeleted:
			if err := r.DeleteFile(ctx, fileInfo); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}
		}
	}

	return nil
}

func (r *replicator) DeleteFile(ctx context.Context, fileInfo *repository.FileInfo) error {
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

func (r *replicator) Validate(ctx context.Context, fileInfo *repository.FileInfo) (bool, error) {
	if _, err := r.parseResource(ctx, fileInfo); err != nil {
		if errors.Is(err, ErrUnableToReadResourceBytes) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

func (r *replicator) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*ParsedResource, error) {
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

func (r *replicator) Export(ctx context.Context) error {
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

func (r *replicator) fetchRepoFolderTree(ctx context.Context) (*folderTree, error) {
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

func (*replicator) marshalPreferredFormat(obj any, name string, repo repository.Repository) (body []byte, fileName string, err error) {
	if repo.Config().Spec.PreferYAML {
		body, err = yaml.Marshal(obj)
		return body, name + ".yaml", err
	} else {
		body, err := json.MarshalIndent(obj, "", "    ")
		return body, name + ".json", err
	}
}

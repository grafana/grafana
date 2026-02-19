package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

const (
	// Files endpoint max size for dashboards etc (5MB)
	filesMaxBodySize = 5 * 1024 * 1024
)

type filesConnector struct {
	getter  RepoGetter
	access  auth.AccessChecker
	parsers resources.ParserFactory
	clients resources.ClientFactory
}

func NewFilesConnector(getter RepoGetter, parsers resources.ParserFactory, clients resources.ClientFactory, access auth.AccessChecker) *filesConnector {
	return &filesConnector{getter: getter, parsers: parsers, clients: clients, access: access}
}

func (*filesConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*filesConnector) Destroy() {}

func (*filesConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*filesConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceWrapper{}
}

func (*filesConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete}
}

func (*filesConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true adds the {path} component
}

// For GET operations, allow even unhealthy repositories
// For write operations (POST, PUT, DELETE), require healthy repository
func (c *filesConnector) getRepo(ctx context.Context, method, name string) (repository.Repository, error) {
	if method == http.MethodGet {
		return c.getter.GetRepository(ctx, name)
	} else {
		return c.getter.GetHealthyRepository(ctx, name)
	}
}

// TODO: document the synchronous write and delete on the API Spec
func (c *filesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "files-connector", "repository_name", name)
	ctx = logging.Context(ctx, logger)

	return WithTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c.handleRequest(ctx, name, r, responder, logger)
	}), 30*time.Second), nil
}

// handleRequest processes the HTTP request for files operations.
func (c *filesConnector) handleRequest(ctx context.Context, name string, r *http.Request, responder rest.Responder, logger logging.Logger) {
	repo, err := c.getRepo(ctx, r.Method, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		responder.Error(err)
		return
	}

	readWriter, ok := repo.(repository.ReaderWriter)
	if !ok {
		responder.Error(apierrors.NewBadRequest("repository does not support read-writing"))
		return
	}

	dualReadWriter, err := c.createDualReadWriter(ctx, repo, readWriter)
	if err != nil {
		responder.Error(err)
		return
	}

	opts, err := c.parseRequestOptions(r, name, repo)
	if err != nil {
		responder.Error(apierrors.NewBadRequest(err.Error()))
		return
	}

	logger = logger.With("url", r.URL.Path, "ref", opts.Ref, "message", opts.Message)
	ctx = logging.Context(r.Context(), logger)

	// Handle directory listing separately
	isDir := safepath.IsDir(opts.Path)
	if r.Method == http.MethodGet && isDir {
		c.handleDirectoryListing(ctx, name, opts, readWriter, responder)
		return
	}

	if opts.Path == "" {
		responder.Error(apierrors.NewBadRequest("missing request path"))
		return
	}

	// Enforce quota for write operations
	if r.Method == http.MethodPost || r.Method == http.MethodPut {
		// Post with Original Path is a move operation
		isCreate := r.Method == http.MethodPost && opts.OriginalPath == ""
		if err := checkQuota(repo, isCreate); err != nil {
			respondWithError(responder, err)
			return
		}
	}

	obj, err := c.handleMethodRequest(ctx, r, opts, isDir, dualReadWriter)
	if err != nil {
		logger.Debug("got an error after processing request", "error", err)
		respondWithError(responder, err)
		return
	}

	code := http.StatusOK
	if len(obj.Errors) > 0 {
		code = http.StatusPartialContent
	}

	logger.Debug("request resulted in valid object", "object", obj)
	responder.Object(code, obj)
}

// createDualReadWriter sets up the dual read writer with all required dependencies.
func (c *filesConnector) createDualReadWriter(ctx context.Context, repo repository.Repository, readWriter repository.ReaderWriter) (*resources.DualReadWriter, error) {
	parser, err := c.parsers.GetParser(ctx, readWriter)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser: %w", err)
	}

	clients, err := c.clients.Clients(ctx, repo.Config().Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get clients: %w", err)
	}

	folderClient, err := clients.Folder(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get folder client: %w", err)
	}

	folders := resources.NewFolderManager(readWriter, folderClient, resources.NewEmptyFolderTree())
	return resources.NewDualReadWriter(readWriter, parser, folders, c.access), nil
}

// parseRequestOptions extracts options from the HTTP request.
func (c *filesConnector) parseRequestOptions(r *http.Request, name string, repo repository.Repository) (resources.DualWriteOptions, error) {
	query := r.URL.Query()
	opts := resources.DualWriteOptions{
		Ref:          query.Get("ref"),
		Message:      query.Get("message"),
		SkipDryRun:   query.Get("skipDryRun") == "true",
		OriginalPath: query.Get("originalPath"),
		Branch:       repo.Config().Branch(),
	}

	path, err := pathAfterPrefix(r.URL.Path, fmt.Sprintf("/%s/files", name))
	if err != nil {
		return opts, err
	}
	opts.Path = path

	if err := resources.IsPathSupported(opts.Path); err != nil {
		return opts, err
	}

	return opts, nil
}

// handleDirectoryListing handles GET requests for directory listing.
func (c *filesConnector) handleDirectoryListing(ctx context.Context, name string, opts resources.DualWriteOptions, readWriter repository.ReaderWriter, responder rest.Responder) {
	if err := c.authorizeListFiles(ctx, name); err != nil {
		responder.Error(err)
		return
	}

	files, err := c.listFolderFiles(ctx, opts.Path, opts.Ref, readWriter)
	if err != nil {
		responder.Error(err)
		return
	}

	responder.Object(http.StatusOK, files)
}

// handleMethodRequest routes the request to the appropriate handler based on HTTP method.
func (c *filesConnector) handleMethodRequest(ctx context.Context, r *http.Request, opts resources.DualWriteOptions, isDir bool, dualReadWriter *resources.DualReadWriter) (*provisioning.ResourceWrapper, error) {
	switch r.Method {
	case http.MethodGet:
		return c.handleGet(ctx, opts, dualReadWriter)
	case http.MethodPost:
		return c.handlePost(ctx, r, opts, isDir, dualReadWriter)
	case http.MethodPut:
		return c.handlePut(ctx, r, opts, isDir, dualReadWriter)
	case http.MethodDelete:
		return c.handleDelete(ctx, opts, dualReadWriter)
	default:
		return nil, apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
	}
}

func (c *filesConnector) handleGet(ctx context.Context, opts resources.DualWriteOptions, dualReadWriter *resources.DualReadWriter) (*provisioning.ResourceWrapper, error) {
	resource, err := dualReadWriter.Read(ctx, opts.Path, opts.Ref)
	if err != nil {
		return nil, err
	}
	return resource.AsResourceWrapper(), nil
}

func (c *filesConnector) handlePost(ctx context.Context, r *http.Request, opts resources.DualWriteOptions, isDir bool, dualReadWriter *resources.DualReadWriter) (*provisioning.ResourceWrapper, error) {
	// Check if this is a move operation (originalPath query parameter is present)
	if opts.OriginalPath != "" {
		return c.handleMove(ctx, r, opts, isDir, dualReadWriter)
	}

	if isDir {
		return dualReadWriter.CreateFolder(ctx, opts)
	}

	data, err := readBody(r, filesMaxBodySize)
	if err != nil {
		return nil, err
	}
	opts.Data = data

	resource, err := dualReadWriter.CreateResource(ctx, opts)
	if err != nil {
		return nil, err
	}
	return resource.AsResourceWrapper(), nil
}

func (c *filesConnector) handleMove(ctx context.Context, r *http.Request, opts resources.DualWriteOptions, isDir bool, dualReadWriter *resources.DualReadWriter) (*provisioning.ResourceWrapper, error) {
	// For move operations, only read body for file moves (not directory moves)
	if !isDir {
		data, err := readBody(r, filesMaxBodySize)
		if err != nil {
			return nil, err
		}
		opts.Data = data
	}

	resource, err := dualReadWriter.MoveResource(ctx, opts)
	if err != nil {
		return nil, err
	}
	return resource.AsResourceWrapper(), nil
}

func (c *filesConnector) handlePut(ctx context.Context, r *http.Request, opts resources.DualWriteOptions, isDir bool, dualReadWriter *resources.DualReadWriter) (*provisioning.ResourceWrapper, error) {
	if isDir {
		return nil, apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method)
	}

	data, err := readBody(r, filesMaxBodySize)
	if err != nil {
		return nil, err
	}
	opts.Data = data

	resource, err := dualReadWriter.UpdateResource(ctx, opts)
	if err != nil {
		return nil, err
	}
	return resource.AsResourceWrapper(), nil
}

func (c *filesConnector) handleDelete(ctx context.Context, opts resources.DualWriteOptions, dualReadWriter *resources.DualReadWriter) (*provisioning.ResourceWrapper, error) {
	resource, err := dualReadWriter.Delete(ctx, opts)
	if err != nil {
		return nil, err
	}
	return resource.AsResourceWrapper(), nil
}

// authorizeListFiles checks if the user has repositories:read permission for listing files.
// The access checker handles AccessPolicy identities, namespace resolution, and role-based fallback internally.
func (c *filesConnector) authorizeListFiles(ctx context.Context, repoName string) error {
	return c.access.Check(ctx, authlib.CheckRequest{
		Verb:     utils.VerbGet,
		Group:    provisioning.GROUP,
		Resource: provisioning.RepositoryResourceInfo.GetName(),
		Name:     repoName,
	}, "")
}

// listFolderFiles returns a list of files in a folder.
// Authorization is checked via authorizeListFiles before calling this function.
func (c *filesConnector) listFolderFiles(ctx context.Context, filePath string, ref string, readWriter repository.ReaderWriter) (*provisioning.FileList, error) {
	// TODO: Implement folder navigation
	if len(filePath) > 0 {
		return nil, apierrors.NewBadRequest("folder navigation not yet supported")
	}

	// TODO: Add pagination
	rsp, err := readWriter.ReadTree(ctx, ref)
	if err != nil {
		return nil, err
	}

	files := &provisioning.FileList{}
	for _, v := range rsp {
		if !v.Blob {
			continue // folder item
		}
		files.Items = append(files.Items, provisioning.FileItem{
			Path: v.Path,
			Size: v.Size,
			Hash: v.Hash,
		})
	}

	return files, nil
}

// checkQuota verifies that the repository resource quota allows the operation.
func checkQuota(repo repository.Repository, isCreate bool) error {
	cfg := repo.Config()
	conditions := cfg.Status.Conditions

	if quotas.IsQuotaExceeded(conditions) {
		return apierrors.NewForbidden(
			provisioning.RepositoryResourceInfo.GroupResource(),
			cfg.Name,
			quotas.NewQuotaExceededError(fmt.Errorf("quota exceeded")))
	}

	if quotas.IsQuotaReached(conditions) && isCreate {
		return apierrors.NewForbidden(
			provisioning.RepositoryResourceInfo.GroupResource(),
			cfg.Name,
			quotas.NewQuotaExceededError(fmt.Errorf("would exceced quota")))
	}

	return nil
}

var (
	_ rest.Storage         = (*filesConnector)(nil)
	_ rest.Connecter       = (*filesConnector)(nil)
	_ rest.StorageMetadata = (*filesConnector)(nil)
)

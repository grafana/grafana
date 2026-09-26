package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const maxResourceResolvePaths = 100

// Allow the maximum number of paths at safepath's maximum length plus JSON overhead.
const maxResourceResolveBodySize = 128 * 1024

// TODO: Rename to resources as it's not clear that we are returning here is repository resources
type listConnector struct {
	lister  resources.ResourceLister
	clients resources.ClientFactory
	access  auth.AccessChecker
}

func NewListConnector(lister resources.ResourceLister, clients resources.ClientFactory, access auth.AccessChecker) *listConnector {
	return &listConnector{lister: lister, clients: clients, access: access}
}

func (*listConnector) New() runtime.Object {
	return &provisioning.ResourceList{}
}

func (*listConnector) Destroy() {}

func (*listConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*listConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceList{}
}

func (*listConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPost}
}

func (*listConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (s *listConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, err := pathAfterPrefix(r.URL.Path, fmt.Sprintf("/repositories/%s/resources", name))
		if err != nil {
			responder.Error(err)
			return
		}
		// Enabling connector subpaths registers a wildcard; only these two operations are supported.
		var method string
		switch path {
		case "":
			method = http.MethodGet
		case "resolve":
			method = http.MethodPost
		default:
			responder.Error(resourceLookupNotFound())
			return
		}
		if r.Method != method {
			w.Header().Set("Allow", method)
			responder.Error(apierrors.NewMethodNotSupported(provisioning.RepositoryResourceInfo.GroupResource(), r.Method))
			return
		}
		ns := request.NamespaceValue(ctx)
		if path == "resolve" {
			s.handleResolveRequest(ctx, ns, name, w, r)
			return
		}
		// TODO: Add pagination to resource lister
		rsp, err := s.lister.List(ctx, ns, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, rsp)
		}
	}), nil
}

func (s *listConnector) handleResolveRequest(ctx context.Context, namespace, repo string, w http.ResponseWriter, r *http.Request) {
	caller, ok := authlib.AuthInfoFrom(ctx)
	if !ok || caller == nil {
		errhttp.Write(ctx, apierrors.NewUnauthorized("authentication required"), w)
		return
	}
	if namespace == "" || !authlib.NamespaceMatches(caller.GetNamespace(), namespace) {
		errhttp.Write(ctx, apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), repo, errors.New("namespace mismatch")), w)
		return
	}
	if repo == "" {
		errhttp.Write(ctx, apierrors.NewBadRequest("repository name is required"), w)
		return
	}
	var body provisioning.ResourceResolveRequest
	if err := unmarshalJSON(r, maxResourceResolveBodySize, &body); err != nil {
		errhttp.Write(ctx, apierrors.NewBadRequest("invalid resource resolve request"), w)
		return
	}
	result, err := s.resolve(ctx, namespace, repo, body.Paths)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (s *listConnector) resolve(ctx context.Context, namespace, repo string, paths []string) (*provisioning.ResourceResolveResponse, error) {
	if len(paths) == 0 || len(paths) > maxResourceResolvePaths {
		return nil, apierrors.NewBadRequest("paths must contain between 1 and 100 resource paths")
	}
	for _, path := range paths {
		if path == "" || strings.HasPrefix(path, "/") || safepath.IsSafe(path) != nil {
			return nil, apierrors.NewBadRequest("invalid resource path")
		}
	}
	listed, err := s.lister.List(ctx, namespace, repo)
	if err != nil {
		return nil, apierrors.NewInternalError(errors.New("unable to resolve resources"))
	}
	clients, err := s.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, apierrors.NewInternalError(errors.New("unable to resolve resources"))
	}
	result := &provisioning.ResourceResolveResponse{Results: make([]provisioning.ResourceResolveResult, 0, len(paths))}
	seen := make(map[string]bool, len(paths))
	for _, path := range paths {
		if seen[path] {
			continue
		}
		seen[path] = true
		// A failure for one target must neither disclose its metadata nor prevent resolving other paths.
		item, _ := s.lookup(ctx, clients, namespace, repo, path, listed.Items)
		result.Results = append(result.Results, provisioning.ResourceResolveResult{Path: path, Resource: item})
	}
	return result, nil
}

func matchesResourcePath(path, sourcePath, group, resource string) bool {
	if group == resources.FolderResource.Group && resource == resources.FolderResource.Resource {
		return strings.TrimSuffix(path, "/") == strings.TrimSuffix(sourcePath, "/")
	}
	return path == sourcePath
}

func resourceLookupNotFound() error {
	return apierrors.NewNotFound(provisioning.RepositoryResourceInfo.GroupResource(), "resource")
}

func (s *listConnector) lookup(ctx context.Context, clients resources.ResourceClients, namespace, repo, path string, items []provisioning.ResourceListItem) (*provisioning.ResourceListItem, error) {
	var result *provisioning.ResourceListItem
	seen := make(map[schema.GroupResource]map[string]bool)
	for _, item := range items {
		if item.Name == "" || !matchesResourcePath(path, item.Path, item.Group, item.Resource) {
			continue
		}
		gr := schema.GroupResource{Group: item.Group, Resource: item.Resource}
		if seen[gr] == nil {
			seen[gr] = make(map[string]bool)
		}
		if seen[gr][item.Name] {
			continue
		}
		seen[gr][item.Name] = true
		client, _, err := clients.ForResource(ctx, gr.WithVersion(""))
		if err != nil {
			return nil, err
		}
		current, err := client.Get(ctx, item.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			continue
		}
		if err != nil {
			return nil, err
		}
		if current.GetNamespace() != namespace || current.GetName() != item.Name || current.GetDeletionTimestamp() != nil {
			continue
		}
		meta, err := utils.MetaAccessor(current)
		if err != nil {
			return nil, err
		}
		manager, _ := meta.GetManagerProperties()
		source, _ := meta.GetSourceProperties()
		if manager.Kind != utils.ManagerKindRepo || manager.Identity != repo || !matchesResourcePath(path, source.Path, item.Group, item.Resource) {
			continue
		}
		// The index can lag behind a move, so authorization uses the current object's folder.
		if !identity.IsServiceIdentity(ctx) {
			if err := s.access.Check(ctx, authlib.CheckRequest{
				Namespace: namespace,
				Group:     item.Group,
				Resource:  item.Resource,
				Name:      current.GetName(),
				Verb:      utils.VerbGet,
			}, meta.GetFolder()); err != nil {
				return nil, err
			}
		}
		if result != nil {
			return nil, resourceLookupNotFound()
		}
		result = &provisioning.ResourceListItem{
			Path: source.Path, Group: item.Group, Resource: item.Resource, Name: current.GetName(),
			Hash: source.Checksum, Time: source.TimestampMillis, Title: meta.FindTitle(""), Folder: meta.GetFolder(),
		}
	}
	if result == nil {
		return nil, resourceLookupNotFound()
	}
	return result, nil
}

var (
	_ rest.Storage         = (*listConnector)(nil)
	_ rest.Connecter       = (*listConnector)(nil)
	_ rest.StorageMetadata = (*listConnector)(nil)
)

package client

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// K8sHandlerProvider is a provider for K8sHandler instances.
// It is used to get a K8sHandler instance for a given namespace.
type K8sHandlerProvider interface {
	GetOrCreateHandler(namespace string) K8sHandler
}

type K8sHandler interface {
	GetNamespace(orgID int64) string
	Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error)
	Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.CreateOptions) (*unstructured.Unstructured, error)
	Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.UpdateOptions) (*unstructured.Unstructured, error)
	Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error
	DeleteCollection(ctx context.Context, orgID int64) error
	List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error)
	Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
	GetStats(ctx context.Context, orgID int64) (*resourcepb.ResourceStatsResponse, error)
	GetUsersFromMeta(ctx context.Context, userMeta []string) (map[string]*user.User, error)
}

var _ K8sHandler = (*k8sHandler)(nil)

type k8sHandler struct {
	namespacer  request.NamespaceMapper
	gvr         schema.GroupVersionResource
	restConfig  func(context.Context) (*rest.Config, error)
	searcher    resourcepb.ResourceIndexClient
	userService user.Service
}

func NewK8sHandler(dual dualwrite.Service, namespacer request.NamespaceMapper, gvr schema.GroupVersionResource,
	restConfig func(context.Context) (*rest.Config, error), dashStore dashboards.Store, userSvc user.Service, resourceClient resource.ResourceClient, sorter sort.Service, features featuremgmt.FeatureToggles) K8sHandler {
	legacySearcher := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), gvr.GroupResource(), resourceClient, legacySearcher, features)

	return &k8sHandler{
		namespacer:  namespacer,
		gvr:         gvr,
		restConfig:  restConfig,
		searcher:    searchClient,
		userService: userSvc,
	}
}

func (h *k8sHandler) GetNamespace(orgID int64) string {
	return h.namespacer(orgID)
}

func (h *k8sHandler) Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	client, err := h.getClient(ctx, orgID)
	if err != nil {
		return nil, err
	}

	return client.Get(ctx, name, options, subresource...)
}

func (h *k8sHandler) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.CreateOptions) (*unstructured.Unstructured, error) {
	client, err := h.getClient(ctx, orgID)
	if err != nil {
		return nil, err
	}

	return client.Create(ctx, obj, opts)
}

func (h *k8sHandler) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64, opts v1.UpdateOptions) (*unstructured.Unstructured, error) {
	client, err := h.getClient(ctx, orgID)
	if err != nil {
		return nil, err
	}

	return client.Update(ctx, obj, opts)
}

func (h *k8sHandler) Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error {
	client, err := h.getClient(ctx, orgID)
	if err != nil {
		return err
	}

	return client.Delete(ctx, name, options)
}

func (h *k8sHandler) DeleteCollection(ctx context.Context, orgID int64) error {
	client, err := h.getClient(ctx, orgID)
	if err != nil {
		return err
	}

	return client.DeleteCollection(ctx, v1.DeleteOptions{}, v1.ListOptions{})
}

func (h *k8sHandler) List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error) {
	client, err := h.getClient(ctx, orgID)
	if err != nil {
		return nil, err
	}

	return client.List(ctx, options)
}

func (h *k8sHandler) Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	// goes directly through grpc, so doesn't need the new context
	if in.Options == nil {
		in.Options = &resourcepb.ListOptions{}
	}

	if in.Options.Key == nil {
		in.Options.Key = &resourcepb.ResourceKey{
			Namespace: h.GetNamespace(orgID),
			Group:     h.gvr.Group,
			Resource:  h.gvr.Resource,
		}
	}

	return h.searcher.Search(ctx, in)
}

func (h *k8sHandler) GetStats(ctx context.Context, orgID int64) (*resourcepb.ResourceStatsResponse, error) {
	// goes directly through grpc, so doesn't need the new context
	return h.searcher.GetStats(ctx, &resourcepb.ResourceStatsRequest{
		Namespace: h.GetNamespace(orgID),
		Kinds: []string{
			h.gvr.Group + "/" + h.gvr.Resource,
		},
	})
}

// GetUsersFromMeta takes what meta accessor gives you from `GetCreatedBy` or `GetUpdatedBy` and returns the user(s), with the meta as the key
func (h *k8sHandler) GetUsersFromMeta(ctx context.Context, usersMeta []string) (map[string]*user.User, error) {
	uids := []string{}
	ids := []int64{}
	metaToId := make(map[string]int64)
	metaToUid := make(map[string]string)
	userMap := make(map[string]*user.User)

	for _, userMeta := range usersMeta {
		parts := strings.Split(userMeta, ":")
		if len(parts) < 2 {
			return userMap, nil
		}
		meta := parts[1]

		userId, err := strconv.ParseInt(meta, 10, 64)
		if err == nil {
			ids = append(ids, userId)
			metaToId[userMeta] = userId
		} else {
			uids = append(uids, meta)
			metaToUid[userMeta] = meta
		}
	}

	users, err := h.userService.ListByIdOrUID(ctx, uids, ids)
	if err != nil {
		return userMap, nil
	}

	for _, u := range users {
		for meta, id := range metaToId {
			if u.ID == id {
				userMap[meta] = u
				break
			}
		}
		for meta, uid := range metaToUid {
			if u.UID == uid {
				userMap[meta] = u
				break
			}
		}
	}
	return userMap, err
}

func (h *k8sHandler) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, error) {
	cfg, err := h.restConfig(ctx)
	if err != nil {
		return nil, err
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("could not create dynamic client: %w", err)
	}

	return dyn.Resource(h.gvr).Namespace(h.GetNamespace(orgID)), nil
}

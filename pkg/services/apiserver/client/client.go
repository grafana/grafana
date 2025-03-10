package client

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8sUser "k8s.io/apiserver/pkg/authentication/user"
	k8sRequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type K8sHandler interface {
	GetNamespace(orgID int64) string
	Get(ctx context.Context, name string, orgID int64, options v1.GetOptions, subresource ...string) (*unstructured.Unstructured, error)
	Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error)
	Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error)
	Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error
	DeleteCollection(ctx context.Context, orgID int64) error
	List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error)
	Search(ctx context.Context, orgID int64, in *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error)
	GetStats(ctx context.Context, orgID int64) (*resource.ResourceStatsResponse, error)
	GetUserFromMeta(ctx context.Context, userMeta string) (*user.User, error)
}

var _ K8sHandler = (*k8sHandler)(nil)

type k8sHandler struct {
	namespacer  request.NamespaceMapper
	gvr         schema.GroupVersionResource
	restConfig  func(context.Context) (*rest.Config, error)
	searcher    resource.ResourceIndexClient
	userService user.Service
}

func NewK8sHandler(dual dualwrite.Service, namespacer request.NamespaceMapper, gvr schema.GroupVersionResource,
	restConfig func(context.Context) (*rest.Config, error), dashStore dashboards.Store, userSvc user.Service, resourceClient resource.ResourceClient, sorter sort.Service) K8sHandler {
	legacySearcher := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	searchClient := resource.NewSearchClient(dual, gvr.GroupResource(), resourceClient, legacySearcher)

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
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := h.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, err := h.getClient(newCtx, orgID)
	if err != nil {
		return nil, err
	}

	return client.Get(newCtx, name, options, subresource...)
}

func (h *k8sHandler) Create(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := h.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, err := h.getClient(newCtx, orgID)
	if err != nil {
		return nil, err
	}

	return client.Create(newCtx, obj, v1.CreateOptions{})
}

func (h *k8sHandler) Update(ctx context.Context, obj *unstructured.Unstructured, orgID int64) (*unstructured.Unstructured, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := h.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, err := h.getClient(newCtx, orgID)
	if err != nil {
		return nil, err
	}

	return client.Update(newCtx, obj, v1.UpdateOptions{})
}

func (h *k8sHandler) Delete(ctx context.Context, name string, orgID int64, options v1.DeleteOptions) error {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := h.getK8sContext(ctx)
	if err != nil {
		return err
	} else if cancel != nil {
		defer cancel()
	}

	client, err := h.getClient(newCtx, orgID)
	if err != nil {
		return err
	}

	return client.Delete(newCtx, name, options)
}

func (h *k8sHandler) DeleteCollection(ctx context.Context, orgID int64) error {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := h.getK8sContext(ctx)
	if err != nil {
		return err
	} else if cancel != nil {
		defer cancel()
	}

	client, err := h.getClient(newCtx, orgID)
	if err != nil {
		return err
	}

	return client.DeleteCollection(newCtx, v1.DeleteOptions{}, v1.ListOptions{})
}

func (h *k8sHandler) List(ctx context.Context, orgID int64, options v1.ListOptions) (*unstructured.UnstructuredList, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := h.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, err := h.getClient(newCtx, orgID)
	if err != nil {
		return nil, err
	}

	return client.List(newCtx, options)
}

func (h *k8sHandler) Search(ctx context.Context, orgID int64, in *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	// goes directly through grpc, so doesn't need the new context
	if in.Options == nil {
		in.Options = &resource.ListOptions{}
	}

	if in.Options.Key == nil {
		in.Options.Key = &resource.ResourceKey{
			Namespace: h.GetNamespace(orgID),
			Group:     h.gvr.Group,
			Resource:  h.gvr.Resource,
		}
	}

	return h.searcher.Search(ctx, in)
}

func (h *k8sHandler) GetStats(ctx context.Context, orgID int64) (*resource.ResourceStatsResponse, error) {
	// goes directly through grpc, so doesn't need the new context
	return h.searcher.GetStats(ctx, &resource.ResourceStatsRequest{
		Namespace: h.GetNamespace(orgID),
		Kinds: []string{
			h.gvr.Group + "/" + h.gvr.Resource,
		},
	})
}

// GetUserFromMeta takes what meta accessor gives you from `GetCreatedBy` or `GetUpdatedBy` and returns the user
func (h *k8sHandler) GetUserFromMeta(ctx context.Context, userMeta string) (*user.User, error) {
	parts := strings.Split(userMeta, ":")
	if len(parts) < 2 {
		return &user.User{}, nil
	}
	meta := parts[1]

	userId, err := strconv.ParseInt(meta, 10, 64)
	var u *user.User
	if err == nil {
		u, err = h.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userId})
	} else {
		u, err = h.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: meta})
	}

	if err != nil && errors.Is(err, user.ErrUserNotFound) {
		return &user.User{}, nil
	}
	return u, err
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

func (h *k8sHandler) getK8sContext(ctx context.Context) (context.Context, context.CancelFunc, error) {
	requester, requesterErr := identity.GetRequester(ctx)
	if requesterErr != nil {
		return nil, nil, requesterErr
	}

	user, exists := k8sRequest.UserFrom(ctx)
	if !exists {
		// add in k8s user if not there yet
		var ok bool
		user, ok = requester.(k8sUser.Info)
		if !ok {
			return nil, nil, fmt.Errorf("could not convert user to k8s user")
		}
	}

	newCtx := k8sRequest.WithUser(context.Background(), user)
	newCtx = log.WithContextualAttributes(newCtx, log.FromContext(ctx))
	// TODO: after GLSA token workflow is removed, make this return early
	// and move the else below to be unconditional
	if requesterErr == nil {
		newCtxWithRequester := identity.WithRequester(newCtx, requester)
		newCtx = newCtxWithRequester
	}

	// inherit the deadline from the original context, if it exists
	deadline, ok := ctx.Deadline()
	if ok {
		var newCancel context.CancelFunc
		newCtx, newCancel = context.WithTimeout(newCtx, time.Until(deadline))
		return newCtx, newCancel, nil
	}

	return newCtx, nil, nil
}

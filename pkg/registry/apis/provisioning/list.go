package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// TODO: Rename to resources as it's not clear that we are returning here is repository resources
type listConnector struct {
	lister          resources.ResourceLister
	clients         resources.ClientFactory
	access          auth.AccessChecker
	accessWithAdmin auth.AccessChecker
}

func NewListConnector(lister resources.ResourceLister, clients resources.ClientFactory, access, accessWithAdmin auth.AccessChecker) *listConnector {
	return &listConnector{lister: lister, clients: clients, access: access, accessWithAdmin: accessWithAdmin}
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
	return []string{http.MethodGet}
}

func (*listConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *listConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ns := request.NamespaceValue(ctx)
		rsp, err := s.list(ctx, ns, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(http.StatusOK, rsp)
		}
	}), nil
}

func (s *listConnector) list(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	caller, ok := authlib.AuthInfoFrom(ctx)
	if !ok || caller == nil || caller.GetIdentityType() == authlib.TypeAnonymous {
		return nil, apierrors.NewUnauthorized("authentication required")
	}
	if namespace == "" || !authlib.NamespaceMatches(caller.GetNamespace(), namespace) {
		return nil, apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), repository, errors.New("namespace mismatch"))
	}

	err := s.accessWithAdmin.Check(ctx, authlib.CheckRequest{
		Namespace: namespace,
		Group:     provisioning.GROUP,
		Resource:  provisioning.RepositoryResourceInfo.GetName(),
		Name:      repository,
		Verb:      utils.VerbUpdate,
	}, "")
	if err == nil {
		return s.lister.List(ctx, namespace, repository)
	}
	if !auth.IsPermissionDenied(err) {
		return nil, err
	}

	clients, err := s.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("get resource clients: %w", err)
	}
	resourceTypes := make([]schema.GroupResource, 0)
	for _, supported := range clients.SupportedResources() {
		if !supported.IsActive() {
			continue
		}
		_, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: supported.Group, Kind: supported.Kind})
		if err != nil {
			return nil, fmt.Errorf("resolve resource kind %s: %w", supported.GroupKind, err)
		}
		resourceTypes = append(resourceTypes, gvr.GroupResource())
	}
	result := &provisioning.ResourceList{Items: make([]provisioning.ResourceListItem, 0)}
	if len(resourceTypes) == 0 {
		return result, nil
	}
	listed, err := s.lister.Search(ctx, namespace, repository, resourceTypes)
	if err != nil {
		return nil, err
	}
	if listed == nil {
		return nil, errors.New("empty resource search response")
	}
	for _, item := range listed.Items {
		// Unified Storage does not enforce read permissions for every configurable kind.
		err := s.access.Check(ctx, authlib.CheckRequest{
			Namespace: namespace,
			Group:     item.Group,
			Resource:  item.Resource,
			Name:      item.Name,
			Verb:      utils.VerbGet,
		}, item.Folder)
		if auth.IsPermissionDenied(err) {
			continue
		}
		if err != nil {
			return nil, err
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

var (
	_ rest.Storage         = (*listConnector)(nil)
	_ rest.Connecter       = (*listConnector)(nil)
	_ rest.StorageMetadata = (*listConnector)(nil)
)

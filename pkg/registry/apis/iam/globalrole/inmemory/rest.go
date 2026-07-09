package inmemory

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var _ grafanarest.Storage = (*ReadOnlyGlobalRoleREST)(nil)

var errReadOnly = apierrors.NewMethodNotSupported(
	iamv0.GlobalRoleInfo.GroupResource(), "write operations",
)

// ReadOnlyGlobalRoleREST serves basic roles from memory via the accesscontrol.Service.
type ReadOnlyGlobalRoleREST struct {
	acService accesscontrol.Service
}

func NewReadOnlyGlobalRoleREST(acService accesscontrol.Service) *ReadOnlyGlobalRoleREST {
	return &ReadOnlyGlobalRoleREST{
		acService: acService,
	}
}

func (r *ReadOnlyGlobalRoleREST) New() runtime.Object {
	return iamv0.GlobalRoleInfo.NewFunc()
}

func (r *ReadOnlyGlobalRoleREST) NewList() runtime.Object {
	return iamv0.GlobalRoleInfo.NewListFunc()
}

func (r *ReadOnlyGlobalRoleREST) NamespaceScoped() bool {
	return false
}

func (r *ReadOnlyGlobalRoleREST) GetSingularName() string {
	return iamv0.GlobalRoleInfo.GetSingularName()
}

func (r *ReadOnlyGlobalRoleREST) Destroy() {}

// Get swaps in the app service identity before reading because regular users
// cannot authenticate in the "*" (cluster) namespace, but GlobalRoles are
// cluster-scoped. Authorization for reads is enforced at the k8s authorization
// layer by GetAuthorizer() before this is reached.
func (r *ReadOnlyGlobalRoleREST) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	roles := r.acService.GetStaticRoles(srvCtx)
	for _, dto := range roles {
		if dto.UID == name {
			return roleDTOToV0GlobalRole(dto), nil
		}
	}
	return nil, apierrors.NewNotFound(iamv0.GlobalRoleInfo.GroupResource(), name)
}

// List swaps in the app service identity for the same reason as Get.
func (r *ReadOnlyGlobalRoleREST) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	roles := r.acService.GetStaticRoles(srvCtx)
	items := make([]iamv0.GlobalRole, 0, len(roles))
	for _, dto := range roles {
		items = append(items, *roleDTOToV0GlobalRole(dto))
	}
	return &iamv0.GlobalRoleList{Items: items}, nil
}

func (r *ReadOnlyGlobalRoleREST) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return iamv0.GlobalRoleInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (r *ReadOnlyGlobalRoleREST) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return nil, errReadOnly
}

func (r *ReadOnlyGlobalRoleREST) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, errReadOnly
}

func (r *ReadOnlyGlobalRoleREST) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, errReadOnly
}

func (r *ReadOnlyGlobalRoleREST) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errReadOnly
}

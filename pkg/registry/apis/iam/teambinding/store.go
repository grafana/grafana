package teambinding

import (
	"context"
	"fmt"
	"strconv"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/util"
)

var bindingResource = iamv0alpha1.TeamBindingResourceInfo

var (
	_ rest.Storage              = (*LegacyBindingStore)(nil)
	_ rest.Scoper               = (*LegacyBindingStore)(nil)
	_ rest.SingularNameProvider = (*LegacyBindingStore)(nil)
	_ rest.Getter               = (*LegacyBindingStore)(nil)
	_ rest.Lister               = (*LegacyBindingStore)(nil)
	_ rest.Creater              = (*LegacyBindingStore)(nil)
	_ rest.Updater              = (*LegacyBindingStore)(nil)
	_ rest.GracefulDeleter      = (*LegacyBindingStore)(nil)
	_ rest.CollectionDeleter    = (*LegacyBindingStore)(nil)
)

func NewLegacyBindingStore(store legacy.LegacyIdentityStore, enableAuthnMutation bool) *LegacyBindingStore {
	return &LegacyBindingStore{store, enableAuthnMutation}
}

type LegacyBindingStore struct {
	store               legacy.LegacyIdentityStore
	enableAuthnMutation bool
}

// Destroy implements rest.Storage.
func (l *LegacyBindingStore) Destroy() {}

// New implements rest.Storage.
func (l *LegacyBindingStore) New() runtime.Object {
	return bindingResource.NewFunc()
}

// NewList implements rest.Lister.
func (l *LegacyBindingStore) NewList() runtime.Object {
	return bindingResource.NewListFunc()
}

// NamespaceScoped implements rest.Scoper.
func (l *LegacyBindingStore) NamespaceScoped() bool {
	return true
}

// GetSingularName implements rest.SingularNameProvider.
func (l *LegacyBindingStore) GetSingularName() string {
	return bindingResource.GetSingularName()
}

// ConvertToTable implements rest.Lister.
func (l *LegacyBindingStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return bindingResource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (l *LegacyBindingStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if !l.enableAuthnMutation {
		return nil, false, apierrors.NewMethodNotSupported(bindingResource.GroupResource(), "update")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	oldObj, err := l.Get(ctx, name, nil)
	if err != nil {
		return oldObj, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return oldObj, false, err
	}

	teamBindingObj, ok := obj.(*iamv0alpha1.TeamBinding)
	if !ok {
		return nil, false, fmt.Errorf("expected TeamBinding object, got %T", obj)
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, obj, oldObj); err != nil {
			return oldObj, false, err
		}
	}

	var permission team.PermissionType
	switch teamBindingObj.Spec.Permission {
	case iamv0alpha1.TeamBindingTeamPermissionAdmin:
		permission = team.PermissionTypeAdmin
	case iamv0alpha1.TeamBindingTeamPermissionMember:
		permission = team.PermissionTypeMember
	}

	updateCmd := legacy.UpdateTeamMemberCommand{
		UID:        teamBindingObj.Name,
		Permission: permission,
	}

	_, err = l.store.UpdateTeamMember(ctx, ns, updateCmd)
	if err != nil {
		return oldObj, false, err
	}

	return teamBindingObj, false, nil
}

func (l *LegacyBindingStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if !l.enableAuthnMutation {
		return nil, false, apierrors.NewMethodNotSupported(bindingResource.GroupResource(), "delete")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	err = l.store.DeleteTeamMember(ctx, ns, legacy.DeleteTeamMemberCommand{
		UID: name,
	})
	if err != nil {
		return nil, false, err
	}

	return &iamv0alpha1.TeamBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns.Value,
		},
	}, true, nil
}

func (l *LegacyBindingStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(bindingResource.GroupResource(), "deleteCollection")
}

func (l *LegacyBindingStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if !l.enableAuthnMutation {
		return nil, apierrors.NewMethodNotSupported(bindingResource.GroupResource(), "create")
	}

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	teamMemberObj, ok := obj.(*iamv0alpha1.TeamBinding)
	if !ok {
		return nil, fmt.Errorf("expected TeamBinding object, got %T", obj)
	}

	if teamMemberObj.GenerateName != "" {
		teamMemberObj.Name = teamMemberObj.GenerateName + util.GenerateShortUID()
		teamMemberObj.GenerateName = ""
	}

	if createValidation != nil {
		if err := createValidation(ctx, teamMemberObj); err != nil {
			return nil, err
		}
	}

	// Fetch the user by ID
	userObj, err := l.store.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{
		UID: teamMemberObj.Spec.Subject.Name,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user by id %s: %w", teamMemberObj.Spec.Subject.Name, err)
	}

	// Fetch the team by ID
	teamObj, err := l.store.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{
		UID: teamMemberObj.Spec.TeamRef.Name,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch team by id %s: %w", teamMemberObj.Spec.TeamRef.Name, err)
	}

	var permission team.PermissionType
	switch teamMemberObj.Spec.Permission {
	case iamv0alpha1.TeamBindingTeamPermissionAdmin:
		permission = team.PermissionTypeAdmin
	case iamv0alpha1.TeamBindingTeamPermissionMember:
		permission = team.PermissionTypeMember
	}

	createCmd := legacy.CreateTeamMemberCommand{
		UID:        teamMemberObj.Name,
		TeamID:     teamObj.ID,
		TeamUID:    teamMemberObj.Spec.TeamRef.Name,
		UserID:     userObj.ID,
		UserUID:    teamMemberObj.Spec.Subject.Name,
		Permission: permission,
		External:   teamMemberObj.Spec.External,
	}

	result, err := l.store.CreateTeamMember(ctx, ns, createCmd)
	if err != nil {
		return nil, err
	}

	iamTeam := mapToBindingObject(ns, result.TeamMember)
	return &iamTeam, nil
}

// Get implements rest.Getter.
func (l *LegacyBindingStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res, err := l.store.ListTeamBindings(ctx, ns, legacy.ListTeamBindingsQuery{
		UID:        name,
		Pagination: common.Pagination{Limit: 1},
	})
	if err != nil {
		return nil, err
	}

	if len(res.Bindings) != 1 {
		// FIXME: maybe empty result?
		return nil, bindingResource.NewNotFound(name)
	}

	obj := mapToBindingObject(ns, res.Bindings[0])
	return &obj, nil
}

// List implements rest.Lister.
func (l *LegacyBindingStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res, err := l.store.ListTeamBindings(ctx, ns, legacy.ListTeamBindingsQuery{
		Pagination: common.PaginationFromListOptions(options),
	})
	if err != nil {
		return nil, err
	}

	list := iamv0alpha1.TeamBindingList{
		Items: make([]iamv0alpha1.TeamBinding, 0, len(res.Bindings)),
	}

	for _, b := range res.Bindings {
		list.Items = append(list.Items, mapToBindingObject(ns, b))
	}

	list.Continue = common.OptionalFormatInt(res.Continue)
	list.ResourceVersion = common.OptionalFormatInt(res.RV)

	return &list, nil
}

func mapToBindingObject(ns claims.NamespaceInfo, tm legacy.TeamMember) iamv0alpha1.TeamBinding {
	rv := time.Time{}
	ct := time.Now()

	if tm.Updated.After(rv) {
		rv = tm.Updated
	}
	if tm.Created.Before(ct) {
		ct = tm.Created
	}

	return iamv0alpha1.TeamBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:              tm.UID,
			Namespace:         ns.Value,
			ResourceVersion:   strconv.FormatInt(rv.UnixMilli(), 10),
			CreationTimestamp: metav1.NewTime(ct),
		},
		Spec: iamv0alpha1.TeamBindingSpec{
			TeamRef: iamv0alpha1.TeamBindingTeamRef{
				Name: tm.TeamUID,
			},
			Subject: iamv0alpha1.TeamBindingspecSubject{
				Name: tm.UserUID,
			},
			Permission: common.MapTeamPermission(tm.Permission),
			External:   tm.External,
		},
	}
}

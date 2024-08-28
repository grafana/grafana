package team

import (
	"context"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/claims"
	identityv0 "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/identity/common"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
)

var bindingResource = identityv0.TeamBindingResourceInfo

var (
	_ rest.Storage              = (*LegacyBindingStore)(nil)
	_ rest.Scoper               = (*LegacyBindingStore)(nil)
	_ rest.SingularNameProvider = (*LegacyBindingStore)(nil)
	_ rest.Getter               = (*LegacyBindingStore)(nil)
	_ rest.Lister               = (*LegacyBindingStore)(nil)
)

func NewLegacyBindingStore(store legacy.LegacyIdentityStore) *LegacyBindingStore {
	return &LegacyBindingStore{store}
}

type LegacyBindingStore struct {
	store legacy.LegacyIdentityStore
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
		return nil, resource.NewNotFound(name)
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

	list := identityv0.TeamBindingList{
		Items: make([]identityv0.TeamBinding, 0, len(res.Bindings)),
	}

	for _, b := range res.Bindings {
		list.Items = append(list.Items, mapToBindingObject(ns, b))
	}

	list.ListMeta.Continue = common.OptionalFormatInt(res.Continue)
	list.ListMeta.ResourceVersion = common.OptionalFormatInt(res.RV)

	return &list, nil
}

func mapToBindingObject(ns claims.NamespaceInfo, b legacy.TeamBinding) identityv0.TeamBinding {
	rv := time.Time{}
	ct := time.Now()

	for _, m := range b.Members {
		if m.Updated.After(rv) {
			rv = m.Updated
		}
		if m.Created.Before(ct) {
			ct = m.Created
		}
	}

	return identityv0.TeamBinding{
		ObjectMeta: metav1.ObjectMeta{
			Name:              b.TeamUID,
			Namespace:         ns.Value,
			ResourceVersion:   strconv.FormatInt(rv.UnixMilli(), 10),
			CreationTimestamp: metav1.NewTime(ct),
		},
		Spec: identityv0.TeamBindingSpec{
			TeamRef: identityv0.TeamRef{
				Name: b.TeamUID,
			},
			Subjects: mapToSubjects(b.Members),
		},
	}
}

func mapToSubjects(members []legacy.TeamMember) []identityv0.TeamSubject {
	out := make([]identityv0.TeamSubject, 0, len(members))
	for _, m := range members {
		out = append(out, identityv0.TeamSubject{
			Name:       m.MemberID(),
			Permission: mapPermisson(m.Permission),
		})
	}
	return out
}

func mapPermisson(p team.PermissionType) identityv0.TeamPermission {
	if p == team.PermissionTypeAdmin {
		return identityv0.TeamPermissionAdmin
	} else {
		return identityv0.TeamPermissionMember
	}
}

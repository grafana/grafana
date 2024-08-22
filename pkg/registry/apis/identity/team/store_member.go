package team

import (
	"context"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/claims"
	identityv0 "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/identity/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var memberResource = identityv0.TeamMemberResourceInfo

var (
	_ rest.Storage              = (*LegacyMemberStore)(nil)
	_ rest.Scoper               = (*LegacyMemberStore)(nil)
	_ rest.SingularNameProvider = (*LegacyMemberStore)(nil)
	_ rest.Getter               = (*LegacyMemberStore)(nil)
	_ rest.Lister               = (*LegacyMemberStore)(nil)
)

func NewLegacyMemberStore(store legacy.LegacyIdentityStore) *LegacyMemberStore {
	return &LegacyMemberStore{store}
}

type LegacyMemberStore struct {
	store legacy.LegacyIdentityStore
}

// Destroy implements rest.Storage.
func (l *LegacyMemberStore) Destroy() {}

// New implements rest.Storage.
func (l *LegacyMemberStore) New() runtime.Object {
	return memberResource.NewFunc()
}

// NewList implements rest.Lister.
func (l *LegacyMemberStore) NewList() runtime.Object {
	return memberResource.NewListFunc()
}

// NamespaceScoped implements rest.Scoper.
func (l *LegacyMemberStore) NamespaceScoped() bool {
	return true
}

// GetSingularName implements rest.SingularNameProvider.
func (l *LegacyMemberStore) GetSingularName() string {
	return memberResource.GetSingularName()
}

// ConvertToTable implements rest.Lister.
func (l *LegacyMemberStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return memberResource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// Get implements rest.Getter.
func (l *LegacyMemberStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	internalID, err := strconv.ParseInt(name, 10, 64)
	if err != nil {
		return nil, err
	}

	res, err := l.store.ListTeamMembers(ctx, ns, legacy.ListTeamMembersQuery{
		ID:    internalID,
		Limit: 1,
	})
	if err != nil {
		return nil, err
	}

	if len(res.Members) != 1 {
		// FIXME: maybe empty result?
		return nil, resource.NewNotFound(name)
	}

	obj := mapToMemberObject(ns, res.Members[0])
	return &obj, nil
}

// List implements rest.Lister.
func (l *LegacyMemberStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	res, err := l.store.ListTeamMembers(ctx, ns, legacy.ListTeamMembersQuery{
		Limit: options.Limit,
	})
	if err != nil {
		return nil, err
	}

	list := identityv0.TeamMemberList{
		ListMeta: metav1.ListMeta{
			// TODO: set these
			ResourceVersion: "",
			Continue:        "",
		},
		Items: make([]identityv0.TeamMember, 0, len(res.Members)),
	}

	for _, b := range res.Members {
		list.Items = append(list.Items, mapToMemberObject(ns, b))
	}

	return &list, nil
}

func mapToMemberObject(ns claims.NamespaceInfo, m legacy.TeamMember) identityv0.TeamMember {
	var permission identityv0.TeamPermission
	if m.Permission == 0 {
		permission = identityv0.TeamPermissionMember
	} else {
		permission = identityv0.TeamPermissionAdmin
	}

	return identityv0.TeamMember{
		ObjectMeta: metav1.ObjectMeta{
			Name:              strconv.FormatInt(m.ID, 10),
			Namespace:         ns.Value,
			CreationTimestamp: metav1.NewTime(m.Created),
			ResourceVersion:   strconv.FormatInt(m.Updated.UnixMilli(), 10),
		},

		Spec: identityv0.TeamMemberSpec{
			TeamRef: identityv0.TeamRef{Name: m.TeamUID},
			Subject: identityv0.TeamSubject{
				Kind:       "User",
				Name:       m.UserUID,
				Permission: permission,
			},
		},
	}
}

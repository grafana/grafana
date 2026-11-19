package team

import (
	"context"
	"fmt"
	"slices"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

type listOnlyStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.Lister
}

type listOnlyStore struct {
	listOnlyStorage
	access      authlib.AccessClient
	directory   legacy.LegacyIdentityStore
	hiddenUsers func(context.Context) (map[string]struct{}, error)
}

// NewListOnlyStore lists Teams. Rosters are populated only for authorized access-policy callers.
// Other directory readers receive an empty members array.
// readonly.Wrap also registers get and watch, while this mode serves only the list.
func NewListOnlyStore(storage rest.Storage, access authlib.AccessClient, directory legacy.LegacyIdentityStore, hiddenUsers func(context.Context) (map[string]struct{}, error)) (rest.Storage, error) {
	inner, ok := storage.(listOnlyStorage)
	if !ok {
		return nil, fmt.Errorf("team storage %T does not implement listOnlyStorage", storage)
	}
	return &listOnlyStore{listOnlyStorage: inner, access: access, directory: directory, hiddenUsers: hiddenUsers}, nil
}

func (s *listOnlyStore) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := s.listOnlyStorage.List(ctx, opts)
	if err != nil {
		return nil, err
	}
	list, ok := obj.(*iam.TeamList)
	if !ok {
		return nil, fmt.Errorf("expected TeamList, got %T", obj)
	}
	out := *list
	out.Items = make([]iam.Team, len(list.Items))
	if len(list.Items) == 0 {
		return &out, nil
	}
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	// A cluster-wide list can include identically named Teams in different namespaces.
	byNamespace := make(map[string][]*iam.Team)
	requested := request.NamespaceValue(ctx)
	includeRosters := ident.IsIdentityType(authlib.TypeAccessPolicy)
	for i, t := range list.Items {
		if s.access == nil || t.Name == "" || t.Namespace == "" || t.Namespace == "*" ||
			!authlib.NamespaceMatches(ident.GetNamespace(), t.Namespace) ||
			(requested != "" && requested != "*" && requested != t.Namespace) {
			return nil, apierrors.NewForbidden(iam.TeamResourceInfo.GroupResource(), "", fmt.Errorf("cannot authorize the team in the requested namespace"))
		}
		// Last-applied annotations and managed fields may also contain groups or member names.
		t.Annotations = nil
		t.ManagedFields = nil
		t.Spec.ExternalGroups = nil
		if includeRosters && len(t.Spec.Members) > 0 {
			byNamespace[t.Namespace] = append(byNamespace[t.Namespace], &out.Items[i])
		} else {
			t.Spec.Members = []iam.TeamTeamMember{}
		}
		out.Items[i] = t
	}
	for namespace, teams := range byNamespace {
		if err := s.filterMembers(request.WithNamespace(ctx, namespace), ident, namespace, teams); err != nil {
			return nil, err
		}
	}
	return &out, nil
}

func (s *listOnlyStore) checker(ctx context.Context, ident identity.Requester, namespace, resource, verb string) (authlib.ItemChecker, error) {
	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	check, _, err := s.access.Compile(ctx, ident, authlib.ListRequest{Group: iam.GROUP, Resource: resource, Verb: verb, Namespace: namespace})
	// A missing checker cannot authorize any roster data.
	if err == nil && check == nil {
		return nil, fmt.Errorf("missing %s permission checker for %s", verb, resource)
	}
	return check, err
}

func (s *listOnlyStore) filterMembers(ctx context.Context, ident identity.Requester, namespace string, teams []*iam.Team) error {
	canReadRoster, err := s.checker(ctx, ident, namespace, "teams", utils.VerbGetPermissions)
	if err != nil {
		return err
	}
	canReadUser, err := s.checker(ctx, ident, namespace, "users", utils.VerbList)
	if err != nil {
		return err
	}
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return err
	}
	candidates := sets.New[string]()
	for _, t := range teams {
		members := t.Spec.Members
		t.Spec.Members = []iam.TeamTeamMember{}
		if !canReadRoster(t.Name, "") {
			continue
		}
		for _, member := range members {
			if member.Kind == "User" && member.Name != "" && canReadUser(member.Name, "") {
				candidates.Insert(member.Name)
				t.Spec.Members = append(t.Spec.Members, member)
			}
		}
	}
	if len(candidates) == 0 {
		return nil
	}
	if s.hiddenUsers == nil || s.directory == nil {
		return fmt.Errorf("team roster user lookup is unavailable")
	}
	hidden, err := s.hiddenUsers(ctx)
	if err != nil {
		return err
	}
	visible := sets.New[string]()
	// ListDisplay returns at most 500 users per query.
	for batch := range slices.Chunk(sets.List(candidates), 500) {
		users, err := s.directory.ListDisplay(ctx, ns, legacy.ListDisplayQuery{UIDs: batch})
		if err != nil {
			return err
		}
		for _, u := range users.Items {
			_, isHidden := hidden[u.Login]
			if !u.IsServiceAccount && !isHidden {
				visible.Insert(u.UID)
			}
		}
	}
	for _, t := range teams {
		t.Spec.Members = slices.DeleteFunc(t.Spec.Members, func(m iam.TeamTeamMember) bool { return !visible.Has(m.Name) })
	}
	return nil
}

package team

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"slices"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	grafanarequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
)

type rosterStore struct {
	grafanarest.Storage
	access      authlib.AccessClient
	directory   legacy.LegacyIdentityStore
	hiddenUsers func(context.Context) (map[string]struct{}, error)
	deleted     *teamdelete.DeletedRegistry
}

// NewRosterStore restricts membership on Team get, list and watch to callers with get_permissions, runs the deleted handlers on Delete and refuses deletecollection while any are registered.
func NewRosterStore(inner grafanarest.Storage, access authlib.AccessClient, directory legacy.LegacyIdentityStore, hiddenUsers func(context.Context) (map[string]struct{}, error), deleted *teamdelete.DeletedRegistry) grafanarest.Storage {
	s := &rosterStore{inner, access, directory, hiddenUsers, deleted}
	// Preserve the optional operations and storage metadata of the registry.
	// The dual writer supports collection deletion but does not support watch.
	if w, ok := inner.(rest.Watcher); ok {
		watcher := teamWatcher{w, s}
		if reg, ok := inner.(interface {
			rest.CollectionDeleter
			registryMetadata
		}); ok {
			return struct {
				*rosterStore
				rest.Watcher
				rest.CollectionDeleter
				registryMetadata
			}{s, watcher, guardedCollectionDeleter{reg, s.deleted}, reg}
		}
		if d, ok := inner.(rest.CollectionDeleter); ok {
			return struct {
				*rosterStore
				rest.Watcher
				rest.CollectionDeleter
			}{s, watcher, guardedCollectionDeleter{d, s.deleted}}
		}
		return struct {
			*rosterStore
			rest.Watcher
		}{s, watcher}
	}
	if d, ok := inner.(rest.CollectionDeleter); ok {
		return struct {
			*rosterStore
			rest.CollectionDeleter
		}{s, guardedCollectionDeleter{d, s.deleted}}
	}
	return s
}

// guardedCollectionDeleter refuses collection deletes while deleted handlers are registered, since they would skip them.
type guardedCollectionDeleter struct {
	rest.CollectionDeleter
	deleted *teamdelete.DeletedRegistry
}

func (g guardedCollectionDeleter) DeleteCollection(ctx context.Context, validation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	if g.deleted.HasHandlers() {
		return nil, apierrors.NewMethodNotSupported(iam.TeamResourceInfo.GroupResource(), "deletecollection")
	}
	return g.CollectionDeleter.DeleteCollection(ctx, validation, options, listOptions)
}

var deletedLogger = log.New("team.deleted")

// Delete runs the deleted handlers once after the delete completes, for every dual-write mode.
// A Team deleted through finalizers does not run them, because the delete completes in Update.
func (s *rosterStore) Delete(ctx context.Context, name string, validation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if !s.deleted.HasHandlers() {
		return s.Storage.Delete(ctx, name, validation, options)
	}
	// The internal ID is only on the stored object, so read it before it is gone.
	var teamID int64
	logger := deletedLogger.FromContext(ctx)
	if obj, err := s.Storage.Get(ctx, name, &metav1.GetOptions{}); err != nil {
		if !apierrors.IsNotFound(err) {
			logger.Error("team ID unknown for deleted handlers, get failed", "teamUID", name, "err", err)
		}
	} else if meta, err := utils.MetaAccessor(obj); err != nil {
		logger.Error("team ID unknown for deleted handlers, no accessor", "teamUID", name, "err", err)
	} else {
		teamID = meta.GetDeprecatedInternalID() // nolint:staticcheck
	}
	obj, deleted, err := s.Storage.Delete(ctx, name, validation, options)
	if err != nil || !deleted || (options != nil && dryrun.IsDryRun(options.DryRun)) {
		return obj, deleted, err
	}
	ns, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		logger.Error("team deleted handlers skipped, no namespace", "teamUID", name, "err", err)
		return obj, deleted, nil
	}
	s.deleted.Run(ctx, teamdelete.Deleted{OrgID: ns.OrgID, TeamID: teamID, TeamUID: name})
	return obj, deleted, nil
}

type registryMetadata interface {
	rest.StorageWithReadiness
	rest.ResetFieldsStrategy
	rest.StorageVersionProvider
}

func (s *rosterStore) Get(ctx context.Context, name string, opts *metav1.GetOptions) (runtime.Object, error) {
	obj, err := s.Storage.Get(ctx, name, opts)
	if err != nil {
		return nil, err
	}
	return s.projectTeam(ctx, obj)
}

// PUT and PATCH both use Update. A filtered Team cannot safely replace the stored roster.
func (s *rosterStore) Update(ctx context.Context, name string, info rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, opts *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	namespace := request.NamespaceValue(ctx)
	forbidden := apierrors.NewForbidden(iam.TeamResourceInfo.GroupResource(), name, fmt.Errorf("updating a Team requires full roster visibility"))
	if s.access == nil || namespace == "" || namespace == "*" || !authlib.NamespaceMatches(ident.GetNamespace(), namespace) || usesDirectoryRoster(ident) {
		return nil, false, forbidden
	}
	canReadRoster, err := s.checker(ctx, ident, namespace, "teams", utils.VerbGetPermissions)
	if err != nil {
		return nil, false, err
	}
	if !canReadRoster(name, "") {
		return nil, false, forbidden
	}
	return s.Storage.Update(ctx, name, info, createValidation, updateValidation, forceAllowCreate, opts)
}

func usesDirectoryRoster(ident identity.Requester) bool {
	return ident.IsIdentityType(authlib.TypeAccessPolicy) && !identity.IsServiceIdentityAuth(ident)
}

func (s *rosterStore) projectTeam(ctx context.Context, obj runtime.Object) (runtime.Object, error) {
	t, ok := obj.(*iam.Team)
	if !ok {
		return nil, fmt.Errorf("expected Team, got %T", obj)
	}
	teams := []iam.Team{*t}
	if err := s.project(ctx, teams); err != nil {
		return nil, err
	}
	return &teams[0], nil
}

func (s *rosterStore) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := s.Storage.List(ctx, opts)
	if err != nil {
		return nil, err
	}
	list, ok := obj.(*iam.TeamList)
	if !ok {
		return nil, fmt.Errorf("expected TeamList, got %T", obj)
	}
	out := *list
	out.Items = make([]iam.Team, len(list.Items))
	copy(out.Items, list.Items)
	if err := s.project(ctx, out.Items); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *rosterStore) project(ctx context.Context, items []iam.Team) error {
	if len(items) == 0 {
		return nil
	}
	ident, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	// A cluster-wide list can include identically named Teams in different namespaces.
	byNamespace := make(map[string][]*iam.Team)
	requested := request.NamespaceValue(ctx)
	for i := range items {
		t := &items[i]
		if s.access == nil || t.Name == "" || t.Namespace == "" || t.Namespace == "*" ||
			!authlib.NamespaceMatches(ident.GetNamespace(), t.Namespace) ||
			(requested != "" && requested != "*" && requested != t.Namespace) {
			return apierrors.NewForbidden(iam.TeamResourceInfo.GroupResource(), "", fmt.Errorf("cannot authorize the team in the requested namespace"))
		}
		byNamespace[t.Namespace] = append(byNamespace[t.Namespace], t)
	}
	for namespace, teams := range byNamespace {
		if err := s.filterMembers(request.WithNamespace(ctx, namespace), ident, namespace, teams); err != nil {
			return err
		}
	}
	return nil
}

func (s *rosterStore) checker(ctx context.Context, ident identity.Requester, namespace, resource, verb string) (authlib.ItemChecker, error) {
	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	check, _, err := s.access.Compile(ctx, ident, authlib.ListRequest{Group: iam.GROUP, Resource: resource, Verb: verb, Namespace: namespace})
	// A missing checker cannot authorize any roster data.
	if err == nil && check == nil {
		return nil, fmt.Errorf("missing %s permission checker for %s", verb, resource)
	}
	return check, err
}

func (s *rosterStore) filterMembers(ctx context.Context, ident identity.Requester, namespace string, teams []*iam.Team) error {
	canReadRoster, err := s.checker(ctx, ident, namespace, "teams", utils.VerbGetPermissions)
	if err != nil {
		return err
	}
	directoryScoped := usesDirectoryRoster(ident)
	var canReadUser authlib.ItemChecker
	if directoryScoped {
		canReadUser, err = s.checker(ctx, ident, namespace, "users", utils.VerbList)
		if err != nil {
			return err
		}
	}
	candidates := sets.New[string]()
	for _, t := range teams {
		allowed := canReadRoster(t.Name, "")
		if allowed && !directoryScoped {
			continue
		}
		// Last-applied annotations and managed fields can contain the original roster.
		t.Annotations = nil
		t.ManagedFields = nil
		t.Spec.ExternalGroups = nil
		members := t.Spec.Members
		t.Spec.Members = []iam.TeamTeamMember{}
		if !allowed {
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
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return err
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

type teamWatcher struct {
	source rest.Watcher
	store  *rosterStore
}

func (w teamWatcher) Watch(ctx context.Context, opts *internalversion.ListOptions) (watch.Interface, error) {
	source, err := w.source.Watch(ctx, opts)
	if err != nil {
		return nil, err
	}
	return watch.NewStreamWatcher(&teamWatchDecoder{ctx, source, w.store}, apierrors.NewClientErrorReporter(http.StatusInternalServerError, "WATCH", "")), nil
}

type teamWatchDecoder struct {
	ctx    context.Context
	source watch.Interface
	store  *rosterStore
}

func (d *teamWatchDecoder) Close() { d.source.Stop() }

func (d *teamWatchDecoder) Decode() (watch.EventType, runtime.Object, error) {
	select {
	case <-d.ctx.Done():
		return "", nil, io.EOF
	case ev, ok := <-d.source.ResultChan():
		if !ok {
			return "", nil, io.EOF
		}
		switch ev.Type {
		case watch.Bookmark:
			metaObj, err := meta.Accessor(ev.Object)
			if err != nil {
				return "", nil, err
			}
			out := &iam.Team{}
			out.SetGroupVersionKind(iam.SchemeGroupVersion.WithKind("Team"))
			out.SetResourceVersion(metaObj.GetResourceVersion())
			if metaObj.GetAnnotations()[metav1.InitialEventsAnnotationKey] == "true" {
				out.SetAnnotations(map[string]string{metav1.InitialEventsAnnotationKey: "true"})
			}
			return ev.Type, out, nil
		case watch.Error:
			if status, ok := ev.Object.(*metav1.Status); ok {
				return ev.Type, status, nil
			}
		case watch.Added, watch.Modified, watch.Deleted:
			out, err := d.store.projectTeam(d.ctx, ev.Object)
			return ev.Type, out, err
		}
		return "", nil, fmt.Errorf("unexpected Team watch event %q (%T)", ev.Type, ev.Object)
	}
}

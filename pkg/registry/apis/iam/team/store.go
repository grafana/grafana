package team

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/util"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

var (
	_ rest.Scoper               = (*LegacyStore)(nil)
	_ rest.SingularNameProvider = (*LegacyStore)(nil)
	_ rest.Getter               = (*LegacyStore)(nil)
	_ rest.Lister               = (*LegacyStore)(nil)
	_ rest.Storage              = (*LegacyStore)(nil)
	_ rest.Creater              = (*LegacyStore)(nil)
	_ rest.CollectionDeleter    = (*LegacyStore)(nil)
	_ rest.GracefulDeleter      = (*LegacyStore)(nil)
	_ rest.Updater              = (*LegacyStore)(nil)
)

var teamResource = iamv0alpha1.TeamResourceInfo

func NewLegacyStore(store legacy.LegacyIdentityStore, ac claims.AccessClient, tracer trace.Tracer) *LegacyStore {
	return &LegacyStore{store, ac, tracer}
}

type LegacyStore struct {
	store  legacy.LegacyIdentityStore
	ac     claims.AccessClient
	tracer trace.Tracer
}

func (s *LegacyStore) New() runtime.Object {
	return teamResource.NewFunc()
}

func (s *LegacyStore) Destroy() {}

func (s *LegacyStore) NamespaceScoped() bool {
	// namespace == org
	return true
}

func (s *LegacyStore) GetSingularName() string {
	return teamResource.GetSingularName()
}

func (s *LegacyStore) NewList() runtime.Object {
	return teamResource.NewListFunc()
}

func (s *LegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return teamResource.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *LegacyStore) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(teamResource.GroupResource(), "delete")
}

// Delete implements rest.GracefulDeleter.
func (s *LegacyStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "team.Delete")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	toBeDeleted, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}

	if deleteValidation != nil {
		if err := deleteValidation(ctx, toBeDeleted); err != nil {
			return nil, false, err
		}
	}

	err = s.store.DeleteTeam(ctx, ns, legacy.DeleteTeamCommand{
		UID: name,
	})

	if err != nil {
		return nil, false, err
	}

	return &iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: ns.Value,
		},
	}, true, nil
}

// Update implements rest.Updater.
func (s *LegacyStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "team.Update")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	oldObj, err := s.Get(ctx, name, nil)
	if err != nil {
		return oldObj, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return oldObj, false, err
	}

	teamObj, ok := obj.(*iamv0alpha1.Team)
	if !ok {
		return nil, false, fmt.Errorf("expected Team object, got %T", obj)
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, obj, oldObj); err != nil {
			return oldObj, false, err
		}
	}

	// TOCTOU note: the current-members read happens outside the write tx
	// that runs inside legacy.UpdateTeam, so a concurrent writer may alter
	// the team_member rows between diffMembers and the write. The apiserver
	// resourceVersion check on the Team row does not cover team_member, so
	// full-replace Updates can interleave. The two races that matter:
	//   * Two writers adding the same user: the second INSERT hits the
	//     UNIQUE(org_id, team_id, user_id) constraint; legacy.UpdateTeam
	//     returns ErrTeamMemberAlreadyAdded and we surface 409 below so the
	//     client re-reads and retries.
	//   * A writer deleting a member that is already gone: the DELETE is a
	//     no-op (affects 0 rows) — harmless.
	// Moving this read into WithTransaction would close the remaining gap
	// but requires the legacy store to expose a tx-scoped ListTeamBindings
	// so we don't re-trigger the SQLite self-deadlock described on
	// GetTeamInternalID.
	currentMembers, err := s.listAllTeamMembers(ctx, ns, teamObj.Name)
	if err != nil {
		return oldObj, false, err
	}
	diff, err := diffMembers(currentMembers, teamObj.Spec.Members)
	if err != nil {
		return oldObj, false, apierrors.NewBadRequest(err.Error())
	}

	updateCmd, err := s.buildUpdateCommand(ctx, ns, teamObj, diff)
	if err != nil {
		return oldObj, false, err
	}

	result, err := s.store.UpdateTeam(ctx, ns, updateCmd)
	if err != nil {
		// Race with another writer adding the same member first — surface as
		// 409 so retry.RetryOnConflict (or the client) can re-read and recompute.
		if errors.Is(err, team.ErrTeamMemberAlreadyAdded) {
			return oldObj, false, apierrors.NewConflict(teamResource.GroupResource(), name, err)
		}
		return oldObj, false, err
	}

	members, err := s.listAllTeamMembers(ctx, ns, teamObj.Name)
	if err != nil {
		return oldObj, false, err
	}
	iamTeam, err := toTeamObject(result.Team, ns, members)
	if err != nil {
		return oldObj, false, err
	}

	return &iamTeam, false, nil
}

func (s *LegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ctx, span := s.tracer.Start(ctx, "team.List")
	defer span.End()

	query := legacy.ListTeamQuery{}
	query.ID = getDeprecatedInternalIDFromLabelSelectors(options)

	res, err := common.List(
		ctx, teamResource, s.ac, common.PaginationFromListOptions(options),
		func(ctx context.Context, ns claims.NamespaceInfo, p common.Pagination) (*common.ListResponse[*iamv0alpha1.Team], error) {
			q := query
			q.Pagination = p
			found, err := s.store.ListTeams(ctx, ns, q)

			if err != nil {
				return nil, err
			}

			teamUIDs := make([]string, len(found.Teams))
			for i, t := range found.Teams {
				teamUIDs[i] = t.UID
			}
			membersByTeam, err := s.listTeamMembersForTeams(ctx, ns, teamUIDs)
			if err != nil {
				return nil, err
			}

			teams := make([]*iamv0alpha1.Team, 0, len(found.Teams))
			for _, t := range found.Teams {
				teamObj, err := toTeamObject(t, ns, membersByTeam[t.UID])
				if err != nil {
					return nil, err
				}
				teams = append(teams, &teamObj)
			}

			return &common.ListResponse[*iamv0alpha1.Team]{
				Items:    teams,
				RV:       found.RV,
				Continue: found.Continue,
			}, nil
		},
	)

	if err != nil {
		return nil, fmt.Errorf("failed to list teams: %w", err)
	}

	items := make([]iamv0alpha1.Team, len(res.Items))
	for i, t := range res.Items {
		items[i] = *t
	}

	list := &iamv0alpha1.TeamList{Items: items}
	list.Continue = common.OptionalFormatInt(res.Continue)
	list.ResourceVersion = common.OptionalFormatInt(res.RV)

	return list, nil
}

func (s *LegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ctx, span := s.tracer.Start(ctx, "team.Get")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	found, err := s.store.ListTeams(ctx, ns, legacy.ListTeamQuery{
		OrgID:      ns.OrgID,
		UID:        name,
		Pagination: common.Pagination{Limit: 1},
	})
	if found == nil || err != nil {
		return nil, teamResource.NewNotFound(name)
	}
	if len(found.Teams) < 1 {
		return nil, teamResource.NewNotFound(name)
	}

	members, err := s.listAllTeamMembers(ctx, ns, name)
	if err != nil {
		return nil, fmt.Errorf("failed to list members for team %s: %w", name, err)
	}
	obj, err := toTeamObject(found.Teams[0], ns, members)
	if err != nil {
		return nil, err
	}
	return &obj, nil
}

func (s *LegacyStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx, span := s.tracer.Start(ctx, "team.Create")
	defer span.End()

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	teamObj, ok := obj.(*iamv0alpha1.Team)
	if !ok {
		return nil, fmt.Errorf("expected Team object, got %T", obj)
	}

	if teamObj.GenerateName != "" {
		teamObj.Name = teamObj.GenerateName + util.GenerateShortUID()
		teamObj.GenerateName = ""
	}

	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	createCmd, err := s.buildCreateCommand(ctx, ns, teamObj)
	if err != nil {
		return nil, err
	}

	result, err := s.store.CreateTeam(ctx, ns, createCmd)
	if err != nil {
		if errors.Is(err, team.ErrTeamMemberAlreadyAdded) {
			return nil, apierrors.NewConflict(teamResource.GroupResource(), teamObj.Name, err)
		}
		return nil, err
	}

	members, err := s.listAllTeamMembers(ctx, ns, result.Team.UID)
	if err != nil {
		return nil, err
	}
	iamTeam, err := toTeamObject(result.Team, ns, members)
	if err != nil {
		return nil, err
	}
	return &iamTeam, nil
}

func getDeprecatedInternalIDFromLabelSelectors(options *internalversion.ListOptions) int64 {
	if options.LabelSelector == nil {
		return 0
	}

	reqs, selectable := options.LabelSelector.Requirements()
	if !selectable {
		return 0
	}

	for _, req := range reqs {
		if req.Key() != utils.LabelKeyDeprecatedInternalID || req.Operator() != selection.Equals {
			continue
		}

		vals := req.Values()
		if vals.Len() != 1 {
			return 0
		}

		idStr, _ := vals.PopAny()
		if id, err := strconv.ParseInt(idStr, 10, 64); err == nil {
			return id
		}
	}

	return 0
}

func toTeamObject(t team.Team, ns claims.NamespaceInfo, members []legacy.TeamMember) (iamv0alpha1.Team, error) {
	specMembers := make([]iamv0alpha1.TeamTeamMember, 0, len(members))
	for _, m := range members {
		mapped, err := mapToTeamMember(m)
		if err != nil {
			return iamv0alpha1.Team{}, err
		}
		specMembers = append(specMembers, mapped)
	}
	obj := iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name:              t.UID,
			Namespace:         ns.Value,
			CreationTimestamp: metav1.NewTime(t.Created),
			ResourceVersion:   strconv.FormatInt(t.Updated.UnixMilli(), 10),
		},
		Spec: iamv0alpha1.TeamSpec{
			Title:       t.Name,
			Email:       t.Email,
			Provisioned: t.IsProvisioned,
			ExternalUID: t.ExternalUID,
			Members:     specMembers,
		},
	}
	meta, _ := utils.MetaAccessor(&obj)
	meta.SetUpdatedTimestamp(&t.Updated)
	meta.SetDeprecatedInternalID(t.ID) // nolint:staticcheck

	return obj, nil
}

// listAllTeamMembers paginates ListTeamBindings to completion for a given
// team. Used on the single-team Get / Create / Update read paths.
func (s *LegacyStore) listAllTeamMembers(ctx context.Context, ns claims.NamespaceInfo, teamUID string) ([]legacy.TeamMember, error) {
	var all []legacy.TeamMember
	var continueToken int64
	for {
		page, err := s.store.ListTeamBindings(ctx, ns, legacy.ListTeamBindingsQuery{
			TeamUID:    teamUID,
			Pagination: common.Pagination{Limit: common.MaxListLimit, Continue: continueToken},
		})
		if err != nil {
			return nil, err
		}
		all = append(all, page.Bindings...)
		if page.Continue == 0 {
			break
		}
		continueToken = page.Continue
	}
	return all, nil
}

// listTeamMembersForTeams fetches all members for the given team UIDs in a
// single (paginated) query and groups them by team UID. Removes the List-time
// N+1 of one round trip per team.
func (s *LegacyStore) listTeamMembersForTeams(ctx context.Context, ns claims.NamespaceInfo, teamUIDs []string) (map[string][]legacy.TeamMember, error) {
	out := make(map[string][]legacy.TeamMember, len(teamUIDs))
	if len(teamUIDs) == 0 {
		return out, nil
	}
	var continueToken int64
	for {
		page, err := s.store.ListTeamBindings(ctx, ns, legacy.ListTeamBindingsQuery{
			TeamUIDs:   teamUIDs,
			Pagination: common.Pagination{Limit: common.MaxListLimit, Continue: continueToken},
		})
		if err != nil {
			return nil, err
		}
		for _, m := range page.Bindings {
			out[m.TeamUID] = append(out[m.TeamUID], m)
		}
		if page.Continue == 0 {
			break
		}
		continueToken = page.Continue
	}
	return out, nil
}

// buildCreateCommand assembles the legacy CreateTeamCommand with any initial
// members pre-resolved so the legacy store can insert team + members in one
// SQL transaction. Unknown user UIDs surface as 400 Bad Request.
func (s *LegacyStore) buildCreateCommand(ctx context.Context, ns claims.NamespaceInfo, teamObj *iamv0alpha1.Team) (legacy.CreateTeamCommand, error) {
	cmd := legacy.CreateTeamCommand{
		UID:           teamObj.Name,
		Name:          teamObj.Spec.Title,
		Email:         teamObj.Spec.Email,
		IsProvisioned: teamObj.Spec.Provisioned,
		ExternalUID:   teamObj.Spec.ExternalUID,
	}

	diff, err := diffMembers(nil, teamObj.Spec.Members)
	if err != nil {
		return cmd, apierrors.NewBadRequest(err.Error())
	}
	for _, add := range diff.toAdd {
		userObj, err := s.store.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: add.Name})
		if err != nil {
			return cmd, apierrors.NewBadRequest(fmt.Sprintf("unknown user %q in spec.members", add.Name))
		}
		perm, err := toLegacyPermission(add.Permission)
		if err != nil {
			return cmd, err
		}
		cmd.MemberCreates = append(cmd.MemberCreates, legacy.CreateTeamMemberCommand{
			UID:        util.GenerateShortUID(),
			UserID:     userObj.ID,
			UserUID:    add.Name,
			Permission: perm,
			External:   add.External,
		})
	}
	return cmd, nil
}

// buildUpdateCommand assembles the legacy UpdateTeamCommand — the team row
// update and all member-level changes — so the legacy store can apply them
// atomically in one SQL transaction. Unknown user UIDs surface as 400 Bad
// Request.
func (s *LegacyStore) buildUpdateCommand(ctx context.Context, ns claims.NamespaceInfo, teamObj *iamv0alpha1.Team, diff memberDiff) (legacy.UpdateTeamCommand, error) {
	cmd := legacy.UpdateTeamCommand{
		UID:           teamObj.Name,
		Name:          teamObj.Spec.Title,
		Email:         teamObj.Spec.Email,
		IsProvisioned: teamObj.Spec.Provisioned,
		ExternalUID:   teamObj.Spec.ExternalUID,
	}

	for _, del := range diff.toDelete {
		cmd.MemberDeletes = append(cmd.MemberDeletes, legacy.DeleteTeamMemberCommand{UID: del.UID})
	}
	for _, up := range diff.toUpdate {
		perm, err := toLegacyPermission(up.permission)
		if err != nil {
			return cmd, err
		}
		cmd.MemberUpdates = append(cmd.MemberUpdates, legacy.UpdateTeamMemberCommand{
			UID:        up.binding.UID,
			Permission: perm,
		})
	}
	if len(diff.toAdd) == 0 {
		return cmd, nil
	}

	teamInfo, err := s.store.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{UID: teamObj.Name})
	if err != nil {
		return cmd, fmt.Errorf("failed to fetch team %s: %w", teamObj.Name, err)
	}
	for _, add := range diff.toAdd {
		userObj, err := s.store.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: add.Name})
		if err != nil {
			return cmd, apierrors.NewBadRequest(fmt.Sprintf("unknown user %q in spec.members", add.Name))
		}
		perm, err := toLegacyPermission(add.Permission)
		if err != nil {
			return cmd, err
		}
		cmd.MemberCreates = append(cmd.MemberCreates, legacy.CreateTeamMemberCommand{
			UID:        util.GenerateShortUID(),
			TeamID:     teamInfo.ID,
			TeamUID:    teamObj.Name,
			UserID:     userObj.ID,
			UserUID:    add.Name,
			Permission: perm,
			External:   add.External,
		})
	}
	return cmd, nil
}

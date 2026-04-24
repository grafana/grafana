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
		return oldObj, false, err
	}

	members, err := s.listAllTeamMembers(ctx, ns, teamObj.Name)
	if err != nil {
		return oldObj, false, err
	}
	iamTeam := toTeamObject(result.Team, ns, members)

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

			teams := make([]*iamv0alpha1.Team, 0, len(found.Teams))
			for _, t := range found.Teams {
				// N+1 per team; follow-up to add a bulk ListTeamBindingsByTeams.
				members, err := s.listAllTeamMembers(ctx, ns, t.UID)
				if err != nil {
					return nil, err
				}
				teamObj := toTeamObject(t, ns, members)
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
	obj := toTeamObject(found.Teams[0], ns, members)
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

	createCmd := legacy.CreateTeamCommand{
		UID:           teamObj.Name,
		Name:          teamObj.Spec.Title,
		Email:         teamObj.Spec.Email,
		IsProvisioned: teamObj.Spec.Provisioned,
		ExternalUID:   teamObj.Spec.ExternalUID,
	}

	result, err := s.store.CreateTeam(ctx, ns, createCmd)
	if err != nil {
		return nil, err
	}

	if len(teamObj.Spec.Members) > 0 {
		diff, err := diffMembers(nil, teamObj.Spec.Members)
		if err != nil {
			return nil, apierrors.NewBadRequest(err.Error())
		}
		if err := s.applyMemberDiff(ctx, ns, result.Team.UID, diff); err != nil {
			if errors.Is(err, team.ErrTeamMemberAlreadyAdded) {
				return nil, apierrors.NewConflict(teamResource.GroupResource(), result.Team.UID, err)
			}
			return nil, err
		}
	}

	members, err := s.listAllTeamMembers(ctx, ns, result.Team.UID)
	if err != nil {
		return nil, err
	}
	iamTeam := toTeamObject(result.Team, ns, members)
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

func toTeamObject(t team.Team, ns claims.NamespaceInfo, members []legacy.TeamMember) iamv0alpha1.Team {
	specMembers := make([]iamv0alpha1.TeamTeamMember, 0, len(members))
	for _, m := range members {
		specMembers = append(specMembers, mapToTeamMember(m))
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

	return obj
}

// listAllTeamMembers paginates ListTeamBindings to completion for a given team.
// NOTE: callers typically invoke this per team during List, resulting in N+1
// queries. A bulk `ListTeamBindingsByTeams` in the legacy store would fix this;
// tracked as follow-up.
func (s *LegacyStore) listAllTeamMembers(ctx context.Context, ns claims.NamespaceInfo, teamUID string) ([]legacy.TeamMember, error) {
	var all []legacy.TeamMember
	var continueToken int64
	for {
		page, err := s.store.ListTeamBindings(ctx, ns, legacy.ListTeamBindingsQuery{
			TeamUID:    teamUID,
			Pagination: common.Pagination{Limit: 500, Continue: continueToken},
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

// buildUpdateCommand assembles the legacy UpdateTeamCommand — the team row
// update and all member-level changes — so the legacy store can apply them
// atomically in one SQL transaction.
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
		cmd.MemberUpdates = append(cmd.MemberUpdates, legacy.UpdateTeamMemberCommand{
			UID:        up.binding.UID,
			Permission: toLegacyPermission(up.permission),
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
			return cmd, fmt.Errorf("failed to resolve user %s: %w", add.Name, err)
		}
		cmd.MemberCreates = append(cmd.MemberCreates, legacy.CreateTeamMemberCommand{
			UID:        util.GenerateShortUID(),
			TeamID:     teamInfo.ID,
			TeamUID:    teamObj.Name,
			UserID:     userObj.ID,
			UserUID:    add.Name,
			Permission: toLegacyPermission(add.Permission),
			External:   add.External,
		})
	}
	return cmd, nil
}

// applyMemberDiff applies adds/updates/deletes via legacy team-member calls.
// Used on Create only; Update uses UpdateTeamWithMembers for transactional safety.
// On error the partial progress is surfaced to the caller — no rollback.
func (s *LegacyStore) applyMemberDiff(ctx context.Context, ns claims.NamespaceInfo, teamUID string, diff memberDiff) error {
	var teamID int64
	if len(diff.toAdd) > 0 {
		t, err := s.store.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{UID: teamUID})
		if err != nil {
			return fmt.Errorf("failed to fetch team %s: %w", teamUID, err)
		}
		teamID = t.ID
	}

	for _, del := range diff.toDelete {
		if err := s.store.DeleteTeamMember(ctx, ns, legacy.DeleteTeamMemberCommand{UID: del.UID}); err != nil {
			return fmt.Errorf("failed to remove member %s: %w", del.UserUID, err)
		}
	}

	for _, up := range diff.toUpdate {
		_, err := s.store.UpdateTeamMember(ctx, ns, legacy.UpdateTeamMemberCommand{
			UID:        up.binding.UID,
			Permission: toLegacyPermission(up.permission),
		})
		if err != nil {
			return fmt.Errorf("failed to update member %s: %w", up.binding.UserUID, err)
		}
	}

	for _, add := range diff.toAdd {
		userObj, err := s.store.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: add.Name})
		if err != nil {
			return fmt.Errorf("failed to resolve user %s: %w", add.Name, err)
		}
		_, err = s.store.CreateTeamMember(ctx, ns, legacy.CreateTeamMemberCommand{
			UID:        util.GenerateShortUID(),
			TeamID:     teamID,
			TeamUID:    teamUID,
			UserID:     userObj.ID,
			UserUID:    add.Name,
			Permission: toLegacyPermission(add.Permission),
			External:   add.External,
		})
		if err != nil {
			return fmt.Errorf("failed to add member %s: %w", add.Name, err)
		}
	}
	return nil
}

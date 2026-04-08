package teamk8s

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacysort"
	iamteam "github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var teamGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "teams",
}

var teamBindingGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "teambindings",
}

var userGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "users",
}

type TeamK8sService struct {
	logger          log.Logger
	cfg             *setting.Cfg
	namespaceMapper request.NamespaceMapper
	configProvider  apiserver.DirectRestConfigProvider
}

var _ team.Service = (*TeamK8sService)(nil)

func NewTeamK8sService(logger log.Logger, cfg *setting.Cfg, configProvider apiserver.DirectRestConfigProvider) *TeamK8sService {
	return &TeamK8sService{
		logger:          logger,
		cfg:             cfg,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		configProvider:  configProvider,
	}
}

func (s *TeamK8sService) getDynamicClient(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	if s.configProvider == nil {
		return nil, errors.New("config provider not initialized")
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, errors.New("no request context")
	}

	dyn, err := dynamic.NewForConfig(s.configProvider.GetDirectRestConfig(reqCtx))
	if err != nil {
		return nil, err
	}

	return dyn.Resource(gvr).Namespace(namespace), nil
}

func (s *TeamK8sService) getClient(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	return s.getDynamicClient(ctx, namespace, teamGVR)
}

// resolveTeamUID gets team UID from context or falls back to label-selector lookup by deprecated internal ID.
func (s *TeamK8sService) resolveTeamUID(ctx context.Context, namespace string, teamID int64) (string, error) {
	if uid, ok := team.TeamUIDFrom(ctx); ok {
		return uid, nil
	}
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return "", err
	}
	resolved, err := resolveTeamByLegacyID(ctx, client, teamID)
	if err != nil {
		return "", err
	}
	return resolved.GetName(), nil
}

// resolveUserUID finds a user's K8s UID by their deprecated internal ID label.
func (s *TeamK8sService) resolveUserUID(ctx context.Context, namespace string, userID int64) (string, error) {
	client, err := s.getDynamicClient(ctx, namespace, userGVR)
	if err != nil {
		return "", err
	}

	labelSelector := fmt.Sprintf("%s=%d", utils.LabelKeyDeprecatedInternalID, userID) // nolint:staticcheck
	result, err := client.List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
	if err != nil {
		return "", err
	}

	if len(result.Items) == 0 {
		return "", fmt.Errorf("user with ID %d not found", userID)
	}

	return result.Items[0].GetName(), nil
}

// getUserByUID fetches a K8s user resource by UID and returns identity details.
func (s *TeamK8sService) getUserByUID(ctx context.Context, namespace string, userUID string) (*iamv0alpha1.User, error) {
	client, err := s.getDynamicClient(ctx, namespace, userGVR)
	if err != nil {
		return nil, err
	}

	result, err := client.Get(ctx, userUID, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	var user iamv0alpha1.User
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &user); err != nil {
		return nil, err
	}
	return &user, nil
}

// listTeamBindings lists TeamBinding resources with optional field selectors.
func (s *TeamK8sService) listTeamBindings(ctx context.Context, namespace string, fieldSelector string) ([]iamv0alpha1.TeamBinding, error) {
	client, err := s.getDynamicClient(ctx, namespace, teamBindingGVR)
	if err != nil {
		return nil, err
	}

	result, err := client.List(ctx, metav1.ListOptions{FieldSelector: fieldSelector})
	if err != nil {
		return nil, err
	}

	bindings := make([]iamv0alpha1.TeamBinding, 0, len(result.Items))
	for _, item := range result.Items {
		var binding iamv0alpha1.TeamBinding
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, &binding); err != nil {
			return nil, err
		}
		bindings = append(bindings, binding)
	}
	return bindings, nil
}

func permissionFromBinding(p iamv0alpha1.TeamBindingTeamPermission) team.PermissionType {
	if p == iamv0alpha1.TeamBindingTeamPermissionAdmin {
		return team.PermissionTypeAdmin
	}
	return team.PermissionTypeMember
}

func getResourceID(obj metav1.ObjectMeta) int64 {
	if idStr, ok := obj.Labels[utils.LabelKeyDeprecatedInternalID]; ok { // nolint:staticcheck
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err == nil {
			return id
		}
	}
	return 0
}

func resolveTeamByLegacyID(ctx context.Context, client dynamic.ResourceInterface, id int64) (*unstructured.Unstructured, error) {
	selector := labels.SelectorFromSet(labels.Set{
		utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(id, 10),
	})
	list, err := client.List(ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, team.ErrTeamNotFound
	}
	if len(list.Items) > 1 {
		return nil, team.ErrMultipleTeamsFound
	}
	return &list.Items[0], nil
}

func (s *TeamK8sService) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return team.Team{}, err
	}
	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return team.Team{}, err
	}

	uid := util.GenerateShortUID()
	k8sTeam := iamv0alpha1.Team{
		TypeMeta: metav1.TypeMeta{
			APIVersion: iamv0alpha1.GroupVersion.Identifier(),
			Kind:       "Team",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      uid,
			Namespace: namespace,
		},
		Spec: iamv0alpha1.TeamSpec{
			Title:       cmd.Name,
			Email:       cmd.Email,
			ExternalUID: cmd.ExternalUID,
			Provisioned: cmd.IsProvisioned,
		},
	}

	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&k8sTeam)
	if err != nil {
		return team.Team{}, err
	}

	result, err := client.Create(ctx, &unstructured.Unstructured{Object: unstructuredObj}, metav1.CreateOptions{})
	if err != nil {
		return team.Team{}, err
	}

	var created iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &created); err != nil {
		return team.Team{}, err
	}

	return team.Team{
		ID:            getResourceID(created.ObjectMeta),
		UID:           created.Name,
		OrgID:         orgID,
		Name:          created.Spec.Title,
		Email:         created.Spec.Email,
		ExternalUID:   created.Spec.ExternalUID,
		IsProvisioned: created.Spec.Provisioned,
		Created:       created.CreationTimestamp.Time,
		Updated:       created.GetUpdateTimestamp(),
	}, nil
}

func (s *TeamK8sService) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	orgID := requester.GetOrgID()

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return err
	}

	var result *unstructured.Unstructured
	if uid, ok := team.TeamUIDFrom(ctx); ok {
		result, err = client.Get(ctx, uid, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				return team.ErrTeamNotFound
			}
			return err
		}
	} else {
		result, err = resolveTeamByLegacyID(ctx, client, cmd.ID)
		if err != nil {
			return err
		}
	}

	updated := result.DeepCopy()
	if err := unstructured.SetNestedField(updated.Object, cmd.Name, "spec", "title"); err != nil {
		return err
	}
	if err := unstructured.SetNestedField(updated.Object, cmd.Email, "spec", "email"); err != nil {
		return err
	}
	if err := unstructured.SetNestedField(updated.Object, cmd.ExternalUID, "spec", "externalUID"); err != nil {
		return err
	}

	_, err = client.Update(ctx, updated, metav1.UpdateOptions{})
	return err
}

func (s *TeamK8sService) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	orgID := requester.GetOrgID()

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return err
	}

	uid, ok := team.TeamUIDFrom(ctx)
	if !ok {
		resolved, resolveErr := resolveTeamByLegacyID(ctx, client, cmd.ID)
		if resolveErr != nil {
			return resolveErr
		}
		uid = resolved.GetName()
	}

	err = client.Delete(ctx, uid, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return team.ErrTeamNotFound
		}
		return err
	}

	return nil
}

func (s *TeamK8sService) getRESTClient(ctx context.Context) (*rest.RESTClient, error) {
	if s.configProvider == nil {
		return nil, errors.New("config provider not initialized")
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, errors.New("no request context")
	}

	cfg := dynamic.ConfigFor(s.configProvider.GetDirectRestConfig(reqCtx))
	cfg.GroupVersion = &iamv0alpha1.GroupVersion
	return rest.RESTClientFor(cfg)
}

func (s *TeamK8sService) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	sortParams := legacysort.ConvertToSortParams(query.SortOpts, iamteam.TeamSortFieldMapping())

	namespace := s.namespaceMapper(query.OrgID)
	restClient, err := s.getRESTClient(ctx)
	if err != nil {
		return team.SearchTeamQueryResult{}, err
	}

	req := restClient.Get().
		AbsPath("apis", iamv0alpha1.APIGroup, iamv0alpha1.APIVersion, "namespaces", namespace, "searchTeams").
		Param("membercount", "true")

	if query.Query != "" {
		req = req.Param("query", query.Query)
	}
	if query.Name != "" {
		req = req.Param("title", query.Name)
	}
	if query.Limit > 0 {
		req = req.Param("limit", strconv.Itoa(query.Limit))
	}
	if query.Page > 0 {
		req = req.Param("page", strconv.Itoa(query.Page))
	}
	if query.WithAccessControl {
		req = req.Param("accesscontrol", "true")
	}
	for _, uid := range query.UIDs {
		req = req.Param("uid", uid)
	}
	for _, id := range query.TeamIds {
		req = req.Param("teamId", strconv.FormatInt(id, 10))
	}
	for _, sortParam := range sortParams {
		req = req.Param("sort", sortParam)
	}

	result := req.Do(ctx)
	if err := result.Error(); err != nil {
		return team.SearchTeamQueryResult{}, err
	}

	body, err := result.Raw()
	if err != nil {
		return team.SearchTeamQueryResult{}, err
	}

	var searchResp iamv0alpha1.GetSearchTeamsResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return team.SearchTeamQueryResult{}, err
	}

	teams := make([]*team.TeamDTO, 0, len(searchResp.Hits))
	for _, hit := range searchResp.Hits {
		var memberCount int64
		if hit.MemberCount != nil {
			memberCount = *hit.MemberCount
		}
		teams = append(teams, &team.TeamDTO{
			UID:           hit.Name,
			OrgID:         query.OrgID,
			Name:          hit.Title,
			Email:         hit.Email,
			AvatarURL:     dtos.GetGravatarUrlWithDefault(s.cfg, hit.Email, hit.Title),
			IsProvisioned: hit.Provisioned,
			ExternalUID:   hit.ExternalUID,
			MemberCount:   memberCount,
			AccessControl: hit.AccessControl,
		})
	}

	return team.SearchTeamQueryResult{
		TotalCount: searchResp.TotalHits,
		Teams:      teams,
		Page:       query.Page,
		PerPage:    query.Limit,
	}, nil
}

func (s *TeamK8sService) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	if query.ID == 0 && query.UID == "" {
		return nil, team.ErrTeamNotFound
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := requester.GetOrgID()

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return nil, err
	}

	uid := query.UID
	if uid == "" {
		uid, _ = team.TeamUIDFrom(ctx)
	}

	var result *unstructured.Unstructured
	if uid != "" {
		result, err = client.Get(ctx, uid, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				return nil, team.ErrTeamNotFound
			}
			return nil, err
		}
	} else {
		result, err = resolveTeamByLegacyID(ctx, client, query.ID)
		if err != nil {
			return nil, err
		}
	}

	var fetched iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &fetched); err != nil {
		return nil, err
	}

	return &team.TeamDTO{
		ID:            getResourceID(fetched.ObjectMeta),
		UID:           fetched.Name,
		OrgID:         orgID,
		Name:          fetched.Spec.Title,
		Email:         fetched.Spec.Email,
		ExternalUID:   fetched.Spec.ExternalUID,
		IsProvisioned: fetched.Spec.Provisioned,
	}, nil
}

func (s *TeamK8sService) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, query.UserID)
	if err != nil {
		return nil, err
	}

	bindings, err := s.listTeamBindings(ctx, namespace, fmt.Sprintf("spec.subject.name=%s", userUID))
	if err != nil {
		return nil, err
	}

	if len(bindings) == 0 {
		return []*team.TeamDTO{}, nil
	}

	teamUIDs := make([]string, 0, len(bindings))
	for _, b := range bindings {
		teamUIDs = append(teamUIDs, b.Spec.TeamRef.Name)
	}

	searchResult, err := s.SearchTeams(ctx, &team.SearchTeamsQuery{
		OrgID: orgID,
		UIDs:  teamUIDs,
		Limit: len(teamUIDs),
	})
	if err != nil {
		return nil, err
	}

	return searchResult.Teams, nil
}

func (s *TeamK8sService) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, query.UserID)
	if err != nil {
		return nil, err
	}

	bindings, err := s.listTeamBindings(ctx, namespace, fmt.Sprintf("spec.subject.name=%s", userUID))
	if err != nil {
		return nil, err
	}

	ids := make([]int64, 0, len(bindings))
	for _, b := range bindings {
		teamUID := b.Spec.TeamRef.Name
		client, err := s.getClient(ctx, namespace)
		if err != nil {
			return nil, err
		}
		result, err := client.Get(ctx, teamUID, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				continue
			}
			return nil, err
		}
		id := getResourceID(metav1.ObjectMeta{Labels: result.GetLabels()})
		if id != 0 {
			ids = append(ids, id)
		}
	}

	return ids, nil
}

func (s *TeamK8sService) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	namespace := s.namespaceMapper(orgId)

	teamUID, err := s.resolveTeamUID(ctx, namespace, teamId)
	if err != nil {
		return false, err
	}

	userUID, err := s.resolveUserUID(ctx, namespace, userId)
	if err != nil {
		return false, err
	}

	fieldSelector := fmt.Sprintf("spec.teamRef.name=%s,spec.subject.name=%s", teamUID, userUID)
	bindings, err := s.listTeamBindings(ctx, namespace, fieldSelector)
	if err != nil {
		return false, err
	}

	return len(bindings) > 0, nil
}

func (s *TeamK8sService) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, userID)
	if err != nil {
		return err
	}

	bindings, err := s.listTeamBindings(ctx, namespace, fmt.Sprintf("spec.subject.name=%s", userUID))
	if err != nil {
		return err
	}

	bindingClient, err := s.getDynamicClient(ctx, namespace, teamBindingGVR)
	if err != nil {
		return err
	}

	for _, b := range bindings {
		if err := bindingClient.Delete(ctx, b.Name, metav1.DeleteOptions{}); err != nil {
			if !apierrors.IsNotFound(err) {
				return err
			}
		}
	}

	return nil
}

func (s *TeamK8sService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, userID)
	if err != nil {
		return nil, err
	}

	fieldSelector := fmt.Sprintf("spec.subject.name=%s", userUID)
	if external {
		fieldSelector += ",spec.external=true"
	}

	bindings, err := s.listTeamBindings(ctx, namespace, fieldSelector)
	if err != nil {
		return nil, err
	}

	// Fetch user details once since all bindings are for the same user
	var k8sUser *iamv0alpha1.User
	if len(bindings) > 0 {
		k8sUser, err = s.getUserByUID(ctx, namespace, userUID)
		if err != nil {
			s.logger.Warn("Failed to fetch user details for team membership", "userUID", userUID, "error", err)
		}
	}

	members := make([]*team.TeamMemberDTO, 0, len(bindings))
	for _, b := range bindings {
		dto := &team.TeamMemberDTO{
			OrgID:      orgID,
			TeamUID:    b.Spec.TeamRef.Name,
			UserID:     userID,
			UserUID:    userUID,
			External:   b.Spec.External,
			Permission: permissionFromBinding(b.Spec.Permission),
		}

		if k8sUser != nil {
			dto.Email = k8sUser.Spec.Email
			dto.Name = k8sUser.Spec.Title
			dto.Login = k8sUser.Spec.Login
			dto.AvatarURL = dtos.GetGravatarUrlWithDefault(s.cfg, k8sUser.Spec.Email, k8sUser.Spec.Login)
		}

		// Resolve team ID from the team resource
		teamClient, err := s.getClient(ctx, namespace)
		if err == nil {
			if teamResult, err := teamClient.Get(ctx, b.Spec.TeamRef.Name, metav1.GetOptions{}); err == nil {
				dto.TeamID = getResourceID(metav1.ObjectMeta{Labels: teamResult.GetLabels()})
			}
		}

		members = append(members, dto)
	}

	return members, nil
}

func (s *TeamK8sService) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := requester.GetOrgID()
	namespace := s.namespaceMapper(orgID)

	teamUID := query.TeamUID
	if teamUID == "" {
		teamUID, err = s.resolveTeamUID(ctx, namespace, query.TeamID)
		if err != nil {
			return nil, err
		}
	}

	fieldSelector := fmt.Sprintf("spec.teamRef.name=%s", teamUID)
	if query.External {
		fieldSelector += ",spec.external=true"
	}

	bindings, err := s.listTeamBindings(ctx, namespace, fieldSelector)
	if err != nil {
		return nil, err
	}

	members := make([]*team.TeamMemberDTO, 0, len(bindings))
	for _, b := range bindings {
		userUID := b.Spec.Subject.Name

		dto := &team.TeamMemberDTO{
			OrgID:      orgID,
			TeamID:     query.TeamID,
			TeamUID:    teamUID,
			UserUID:    userUID,
			External:   b.Spec.External,
			Permission: permissionFromBinding(b.Spec.Permission),
		}

		// Enrich with user details
		k8sUser, err := s.getUserByUID(ctx, namespace, userUID)
		if err == nil {
			dto.UserID = getResourceID(k8sUser.ObjectMeta)
			dto.Email = k8sUser.Spec.Email
			dto.Name = k8sUser.Spec.Title
			dto.Login = k8sUser.Spec.Login
			dto.AvatarURL = dtos.GetGravatarUrlWithDefault(s.cfg, k8sUser.Spec.Email, k8sUser.Spec.Login)
		} else {
			s.logger.Warn("Failed to fetch user details for team member", "userUID", userUID, "error", err)
		}

		members = append(members, dto)
	}

	return members, nil
}

func (s *TeamK8sService) RegisterDelete(query string) {}

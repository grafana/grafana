package teamk8s

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	sdkk8s "github.com/grafana/grafana-app-sdk/k8s"
	sdkresource "github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"

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
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacysort"
	iamteam "github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	defaultCacheDuration = 5 * time.Minute
	subjectKindUser      = "User"
	// usersGetParallelism caps concurrent User Gets when enriching members.
	// Small enough that a team with hundreds of members doesn't blast the
	// apiserver, large enough to keep latency bounded.
	usersGetParallelism = 8
)

var teamGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "teams",
}

var userGVR = schema.GroupVersionResource{
	Group:    iamv0alpha1.APIGroup,
	Version:  iamv0alpha1.APIVersion,
	Resource: "users",
}

type TeamK8sService struct {
	logger          log.Logger
	cfg             *setting.Cfg
	tracer          tracing.Tracer
	namespaceMapper request.NamespaceMapper
	configProvider  apiserver.DirectRestConfigProvider
	cache           *localcache.CacheService
}

var _ team.Service = (*TeamK8sService)(nil)

func NewTeamK8sService(logger log.Logger, cfg *setting.Cfg, configProvider apiserver.DirectRestConfigProvider, tracer tracing.Tracer) *TeamK8sService {
	return &TeamK8sService{
		logger:          logger,
		cfg:             cfg,
		tracer:          tracer,
		namespaceMapper: request.GetNamespaceMapper(cfg),
		configProvider:  configProvider,
		cache:           localcache.New(defaultCacheDuration, 2*defaultCacheDuration),
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

func (s *TeamK8sService) resolveUserUID(ctx context.Context, namespace string, userID int64) (string, error) {
	client, err := s.getDynamicClient(ctx, namespace, userGVR)
	if err != nil {
		return "", err
	}

	selector := labels.SelectorFromSet(labels.Set{
		utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(userID, 10),
	})
	result, err := client.List(ctx, metav1.ListOptions{LabelSelector: selector.String()})
	if err != nil {
		return "", err
	}

	if len(result.Items) == 0 {
		return "", user.ErrUserNotFound
	}
	if len(result.Items) > 1 {
		return "", fmt.Errorf("multiple users found with ID %d", userID)
	}

	return result.Items[0].GetName(), nil
}

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

func (s *TeamK8sService) listUsersByUIDs(ctx context.Context, namespace string, uids []string) (map[string]*iamv0alpha1.User, error) {
	if len(uids) == 0 {
		return nil, nil
	}

	client, err := s.getDynamicClient(ctx, namespace, userGVR)
	if err != nil {
		return nil, err
	}

	results := make([]*iamv0alpha1.User, len(uids))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(usersGetParallelism)
	for i, uid := range uids {
		g.Go(func() error {
			obj, err := client.Get(gctx, uid, metav1.GetOptions{})
			if err != nil {
				if apierrors.IsNotFound(err) {
					return nil
				}
				return fmt.Errorf("failed to get user %s: %w", uid, err)
			}
			var user iamv0alpha1.User
			if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &user); err != nil {
				return fmt.Errorf("failed to decode user %s: %w", uid, err)
			}
			results[i] = &user
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	users := make(map[string]*iamv0alpha1.User, len(uids))
	for _, u := range results {
		if u != nil {
			users[u.GetName()] = u
		}
	}
	return users, nil
}

func (s *TeamK8sService) listUserTeams(ctx context.Context, namespace, userUID string) ([]iamv0alpha1.GetUserTeamsUserTeam, error) {
	client, err := s.getUserClient(ctx)
	if err != nil {
		return nil, err
	}

	resp, err := client.GetUserTeams(ctx, sdkresource.Identifier{Namespace: namespace, Name: userUID}, iamv0alpha1.GetUserTeamsRequest{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return resp.Items, nil
}

func (s *TeamK8sService) getUserClient(ctx context.Context) (*iamv0alpha1.UserClient, error) {
	if s.configProvider == nil {
		return nil, errors.New("config provider not initialized")
	}
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, errors.New("no request context")
	}
	restConfig := s.configProvider.GetDirectRestConfig(reqCtx)
	if restConfig == nil {
		return nil, errors.New("rest config not available")
	}
	restConfig.APIPath = "apis"
	registry := sdkk8s.NewClientRegistry(*restConfig, sdkk8s.DefaultClientConfig())
	return iamv0alpha1.NewUserClientFromGenerator(registry)
}

func (s *TeamK8sService) listTeamsByUIDs(ctx context.Context, namespace string, uids []string) (map[string]*iamv0alpha1.Team, error) {
	if len(uids) == 0 {
		return nil, nil
	}

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		return nil, err
	}

	results := make([]*iamv0alpha1.Team, len(uids))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(usersGetParallelism)
	for i, uid := range uids {
		g.Go(func() error {
			obj, err := client.Get(gctx, uid, metav1.GetOptions{})
			if err != nil {
				if apierrors.IsNotFound(err) {
					return nil
				}
				return fmt.Errorf("failed to get team %s: %w", uid, err)
			}
			var t iamv0alpha1.Team
			if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &t); err != nil {
				return fmt.Errorf("failed to decode team %s: %w", uid, err)
			}
			results[i] = &t
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	teams := make(map[string]*iamv0alpha1.Team, len(uids))
	for _, t := range results {
		if t != nil {
			teams[t.GetName()] = t
		}
	}
	return teams, nil
}

func findMemberInTeam(t *iamv0alpha1.Team, userUID string) (iamv0alpha1.TeamTeamMember, bool) {
	for _, member := range t.Spec.Members {
		if member.Kind == subjectKindUser && member.Name == userUID {
			return member, true
		}
	}
	return iamv0alpha1.TeamTeamMember{}, false
}

func permissionFromMember(perm iamv0alpha1.TeamTeamPermission) team.PermissionType {
	if perm == iamv0alpha1.TeamTeamPermissionAdmin {
		return team.PermissionTypeAdmin
	}
	return team.PermissionTypeMember
}

func deprecatedInternalID(obj runtime.Object) int64 {
	if meta, err := utils.MetaAccessor(obj); err == nil {
		return meta.GetDeprecatedInternalID() // nolint:staticcheck
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
	ctx, span := s.tracer.Start(ctx, "team.CreateTeam", trace.WithAttributes(
		attribute.String("name", cmd.Name),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("failed to get requester from context in CreateTeam", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return team.Team{}, err
	}
	orgID := requester.GetOrgID()
	span.SetAttributes(attribute.Int64("orgID", orgID))
	namespace := s.namespaceMapper(orgID)

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
		ctxLogger.Error("failed to encode team to unstructured", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return team.Team{}, err
	}

	result, err := client.Create(ctx, &unstructured.Unstructured{Object: unstructuredObj}, metav1.CreateOptions{})
	if err != nil {
		ctxLogger.Error("k8s team create failed", "namespace", namespace, "orgID", orgID, "name", cmd.Name, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return team.Team{}, err
	}

	var created iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &created); err != nil {
		ctxLogger.Error("failed to decode created team", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return team.Team{}, err
	}

	return team.Team{
		ID:            deprecatedInternalID(&created),
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
	ctx, span := s.tracer.Start(ctx, "team.UpdateTeam", trace.WithAttributes(
		attribute.Int64("teamID", cmd.ID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("failed to get requester from context in UpdateTeam", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	orgID := requester.GetOrgID()
	span.SetAttributes(attribute.Int64("orgID", orgID))

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	var result *unstructured.Unstructured
	if uid, ok := team.TeamUIDFrom(ctx); ok {
		result, err = client.Get(ctx, uid, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				span.RecordError(team.ErrTeamNotFound)
				span.SetStatus(codes.Error, team.ErrTeamNotFound.Error())
				return team.ErrTeamNotFound
			}
			ctxLogger.Error("failed to fetch team by UID for update", "namespace", namespace, "teamUID", uid, "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}
	} else {
		result, err = resolveTeamByLegacyID(ctx, client, cmd.ID)
		if err != nil {
			ctxLogger.Error("failed to resolve team by legacy ID for update", "namespace", namespace, "teamID", cmd.ID, "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}
	}

	updated := result.DeepCopy()
	if err := unstructured.SetNestedField(updated.Object, cmd.Name, "spec", "title"); err != nil {
		ctxLogger.Error("failed to set spec.title on team", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	if err := unstructured.SetNestedField(updated.Object, cmd.Email, "spec", "email"); err != nil {
		ctxLogger.Error("failed to set spec.email on team", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	if err := unstructured.SetNestedField(updated.Object, cmd.ExternalUID, "spec", "externalUID"); err != nil {
		ctxLogger.Error("failed to set spec.externalUID on team", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	_, err = client.Update(ctx, updated, metav1.UpdateOptions{})
	if err != nil {
		ctxLogger.Error("k8s team update failed", "namespace", namespace, "orgID", orgID, "teamID", cmd.ID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	return err
}

func (s *TeamK8sService) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	ctx, span := s.tracer.Start(ctx, "team.DeleteTeam", trace.WithAttributes(
		attribute.Int64("teamID", cmd.ID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("failed to get requester from context in DeleteTeam", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	orgID := requester.GetOrgID()
	span.SetAttributes(attribute.Int64("orgID", orgID))

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	uid, ok := team.TeamUIDFrom(ctx)
	if !ok {
		resolved, resolveErr := resolveTeamByLegacyID(ctx, client, cmd.ID)
		if resolveErr != nil {
			ctxLogger.Error("failed to resolve team by legacy ID for delete", "namespace", namespace, "teamID", cmd.ID, "err", resolveErr)
			span.RecordError(resolveErr)
			span.SetStatus(codes.Error, resolveErr.Error())
			return resolveErr
		}
		uid = resolved.GetName()
	}

	err = client.Delete(ctx, uid, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			span.RecordError(team.ErrTeamNotFound)
			span.SetStatus(codes.Error, team.ErrTeamNotFound.Error())
			return team.ErrTeamNotFound
		}
		ctxLogger.Error("k8s team delete failed", "namespace", namespace, "orgID", orgID, "teamUID", uid, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
	ctx, span := s.tracer.Start(ctx, "team.SearchTeams", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
		attribute.String("query", query.Query),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	sortParams := legacysort.ConvertToSortParams(query.SortOpts, iamteam.TeamSortFieldMapping())

	namespace := s.namespaceMapper(query.OrgID)
	restClient, err := s.getRESTClient(ctx)
	if err != nil {
		ctxLogger.Error("failed to get k8s rest client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
		ctxLogger.Error("k8s team search request failed", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return team.SearchTeamQueryResult{}, err
	}

	body, err := result.Raw()
	if err != nil {
		ctxLogger.Error("failed to read k8s team search response body", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return team.SearchTeamQueryResult{}, err
	}

	var searchResp iamv0alpha1.GetSearchTeamsResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		ctxLogger.Error("failed to decode k8s team search response", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
	ctx, span := s.tracer.Start(ctx, "team.GetTeamByID", trace.WithAttributes(
		attribute.Int64("teamID", query.ID),
		attribute.String("teamUID", query.UID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	if query.ID == 0 && query.UID == "" {
		span.RecordError(team.ErrTeamNotFound)
		span.SetStatus(codes.Error, team.ErrTeamNotFound.Error())
		return nil, team.ErrTeamNotFound
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		ctxLogger.Error("failed to get requester from context in GetTeamByID", "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	orgID := requester.GetOrgID()
	span.SetAttributes(attribute.Int64("orgID", orgID))

	namespace := s.namespaceMapper(orgID)
	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
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
				span.RecordError(team.ErrTeamNotFound)
				span.SetStatus(codes.Error, team.ErrTeamNotFound.Error())
				return nil, team.ErrTeamNotFound
			}
			ctxLogger.Error("failed to fetch team by UID", "namespace", namespace, "teamUID", uid, "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}
	} else {
		result, err = resolveTeamByLegacyID(ctx, client, query.ID)
		if err != nil {
			ctxLogger.Error("failed to resolve team by legacy ID", "namespace", namespace, "teamID", query.ID, "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}
	}

	var fetched iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, &fetched); err != nil {
		ctxLogger.Error("failed to decode team", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	return &team.TeamDTO{
		ID:            deprecatedInternalID(&fetched),
		UID:           fetched.Name,
		OrgID:         orgID,
		Name:          fetched.Spec.Title,
		Email:         fetched.Spec.Email,
		ExternalUID:   fetched.Spec.ExternalUID,
		IsProvisioned: fetched.Spec.Provisioned,
	}, nil
}

func (s *TeamK8sService) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	ctx, span := s.tracer.Start(ctx, "team.GetTeamsByUser", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
		attribute.Int64("userID", query.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID := query.OrgID
	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, query.UserID)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return []*team.TeamDTO{}, nil
		}
		ctxLogger.Error("failed to resolve user UID", "namespace", namespace, "userID", query.UserID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	rows, err := s.listUserTeams(ctx, namespace, userUID)
	if err != nil {
		ctxLogger.Error("failed to list user teams", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	if len(rows) == 0 {
		return []*team.TeamDTO{}, nil
	}

	uids := make([]string, len(rows))
	for i, r := range rows {
		uids[i] = r.Team
	}
	teamsMap, err := s.listTeamsByUIDs(ctx, namespace, uids)
	if err != nil {
		ctxLogger.Error("failed to fetch teams by UID", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	out := make([]*team.TeamDTO, 0, len(rows))
	for _, r := range rows {
		t, ok := teamsMap[r.Team]
		if !ok {
			continue
		}
		out = append(out, &team.TeamDTO{
			ID:            deprecatedInternalID(t),
			UID:           t.Name,
			OrgID:         orgID,
			Name:          t.Spec.Title,
			Email:         t.Spec.Email,
			ExternalUID:   t.Spec.ExternalUID,
			IsProvisioned: t.Spec.Provisioned,
			AvatarURL:     dtos.GetGravatarUrlWithDefault(s.cfg, t.Spec.Email, t.Spec.Title),
		})
	}
	return out, nil
}

func (s *TeamK8sService) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	ctx, span := s.tracer.Start(ctx, "team.GetTeamIDsByUser", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
		attribute.Int64("userID", query.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID := query.OrgID
	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, query.UserID)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return []int64{}, []string{}, nil
		}
		ctxLogger.Error("failed to resolve user UID", "namespace", namespace, "userID", query.UserID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, nil, err
	}

	rows, err := s.listUserTeams(ctx, namespace, userUID)
	if err != nil {
		ctxLogger.Error("failed to list user teams", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, nil, err
	}
	if len(rows) == 0 {
		return []int64{}, []string{}, nil
	}

	uids := make([]string, len(rows))
	for i, r := range rows {
		uids[i] = r.Team
	}
	teamsMap, err := s.listTeamsByUIDs(ctx, namespace, uids)
	if err != nil {
		ctxLogger.Error("failed to fetch teams by UID", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, nil, err
	}

	type teamRef struct {
		teamID  int64
		teamUID string
	}
	refs := make([]teamRef, 0, len(rows))
	for _, r := range rows {
		t, ok := teamsMap[r.Team]
		if !ok {
			continue
		}
		teamID := deprecatedInternalID(t)
		if teamID == 0 {
			// Legacy permission middleware keys off the int64 ID and can't
			// address k8s-native teams, so we drop them from both slices.
			ctxLogger.Debug("skipping team with no deprecated internal ID", "teamUID", t.Name, "userUID", userUID)
			continue
		}
		refs = append(refs, teamRef{teamID: teamID, teamUID: t.Name})
	}

	// Match legacy ORDER BY tm.team_id asc.
	sort.Slice(refs, func(i, j int) bool { return refs[i].teamID < refs[j].teamID })

	idsOut := make([]int64, 0, len(refs))
	uidsOut := make([]string, 0, len(refs))
	for _, ref := range refs {
		idsOut = append(idsOut, ref.teamID)
		uidsOut = append(uidsOut, ref.teamUID)
	}
	return idsOut, uidsOut, nil
}

func (s *TeamK8sService) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	ctx, span := s.tracer.Start(ctx, "team.IsTeamMember", trace.WithAttributes(
		attribute.Int64("orgID", orgId),
		attribute.Int64("teamID", teamId),
		attribute.Int64("userID", userId),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	namespace := s.namespaceMapper(orgId)

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return false, err
	}
	resolved, err := resolveTeamByLegacyID(ctx, client, teamId)
	if err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return false, nil
		}
		ctxLogger.Error("failed to resolve team by legacy ID", "namespace", namespace, "teamID", teamId, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return false, err
	}

	userUID, err := s.resolveUserUID(ctx, namespace, userId)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return false, nil
		}
		ctxLogger.Error("failed to resolve user UID", "namespace", namespace, "userID", userId, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return false, err
	}

	var t iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(resolved.Object, &t); err != nil {
		ctxLogger.Error("failed to decode team", "namespace", namespace, "teamID", teamId, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return false, err
	}
	_, ok := findMemberInTeam(&t, userUID)
	return ok, nil
}

// RemoveUsersMemberships is instance-wide cleanup; the k8s service is namespace-scoped so teamimpl always routes this to legacy.
func (s *TeamK8sService) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return errors.New("not implemented")
}

func (s *TeamK8sService) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	ctx, span := s.tracer.Start(ctx, "team.GetUserTeamMemberships", trace.WithAttributes(
		attribute.Int64("orgID", orgID),
		attribute.Int64("userID", userID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	cacheKey := userTeamMembershipsCacheKey(orgID, userID, external)
	if !bypassCache {
		if cached, found := s.cache.Get(cacheKey); found {
			if teams, ok := cached.([]*team.TeamMemberDTO); ok {
				return cloneTeamMemberDTOs(teams), nil
			}
			s.cache.Delete(cacheKey)
		}
	}

	namespace := s.namespaceMapper(orgID)

	userUID, err := s.resolveUserUID(ctx, namespace, userID)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			s.cache.Set(cacheKey, []*team.TeamMemberDTO{}, defaultCacheDuration)
			return []*team.TeamMemberDTO{}, nil
		}
		ctxLogger.Error("failed to resolve user UID", "namespace", namespace, "userID", userID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	rows, err := s.listUserTeams(ctx, namespace, userUID)
	if err != nil {
		ctxLogger.Error("failed to list user teams", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	filtered := rows
	if external {
		filtered = filtered[:0:0]
		for _, r := range rows {
			if r.External {
				filtered = append(filtered, r)
			}
		}
	}

	if len(filtered) == 0 {
		if !bypassCache {
			s.cache.Set(cacheKey, []*team.TeamMemberDTO{}, defaultCacheDuration)
		}
		return []*team.TeamMemberDTO{}, nil
	}

	uids := make([]string, len(filtered))
	for i, r := range filtered {
		uids[i] = r.Team
	}
	teamsMap, err := s.listTeamsByUIDs(ctx, namespace, uids)
	if err != nil {
		ctxLogger.Error("failed to fetch teams by UID", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	k8sUser, err := s.getUserByUID(ctx, namespace, userUID)
	if err != nil {
		ctxLogger.Error("failed to fetch user by UID", "namespace", namespace, "userUID", userUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	members := make([]*team.TeamMemberDTO, 0, len(filtered))
	for _, r := range filtered {
		t, ok := teamsMap[r.Team]
		if !ok {
			continue
		}
		dto := &team.TeamMemberDTO{
			OrgID:      orgID,
			TeamID:     deprecatedInternalID(t),
			TeamUID:    t.Name,
			UserID:     userID,
			UserUID:    userUID,
			External:   r.External,
			Permission: permissionFromMember(iamv0alpha1.TeamTeamPermission(r.Permission)),
		}
		if k8sUser != nil {
			dto.Email = k8sUser.Spec.Email
			dto.Name = k8sUser.Spec.Title
			dto.Login = k8sUser.Spec.Login
			dto.AvatarURL = dtos.GetGravatarUrlWithDefault(s.cfg, k8sUser.Spec.Email, k8sUser.Spec.Login)
		}
		members = append(members, dto)
	}

	if !bypassCache {
		s.cache.Set(cacheKey, cloneTeamMemberDTOs(members), defaultCacheDuration)
	}

	return members, nil
}

// cloneTeamMemberDTOs deep-copies elements so a caller mutating a returned
// DTO can't poison subsequent cache hits via the shared pointer.
func cloneTeamMemberDTOs(in []*team.TeamMemberDTO) []*team.TeamMemberDTO {
	out := make([]*team.TeamMemberDTO, len(in))
	for i, m := range in {
		if m == nil {
			continue
		}
		clone := *m
		out[i] = &clone
	}
	return out
}

func userTeamMembershipsCacheKey(orgID, userID int64, external bool) string {
	return fmt.Sprintf("teams:%d:%d:%t", orgID, userID, external)
}

func (s *TeamK8sService) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	ctx, span := s.tracer.Start(ctx, "team.GetTeamMembers", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
		attribute.Int64("teamID", query.TeamID),
		attribute.String("teamUID", query.TeamUID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	orgID := query.OrgID
	namespace := s.namespaceMapper(orgID)

	client, err := s.getClient(ctx, namespace)
	if err != nil {
		ctxLogger.Error("failed to get k8s client", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	var teamObj *unstructured.Unstructured
	if query.TeamUID != "" {
		teamObj, err = client.Get(ctx, query.TeamUID, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				span.RecordError(team.ErrTeamNotFound)
				span.SetStatus(codes.Error, team.ErrTeamNotFound.Error())
				return nil, team.ErrTeamNotFound
			}
			ctxLogger.Error("failed to fetch team by UID", "namespace", namespace, "teamUID", query.TeamUID, "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}
	} else {
		teamObj, err = resolveTeamByLegacyID(ctx, client, query.TeamID)
		if err != nil {
			ctxLogger.Error("failed to resolve team by legacy ID", "namespace", namespace, "teamID", query.TeamID, "err", err)
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return nil, err
		}
	}

	var t iamv0alpha1.Team
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(teamObj.Object, &t); err != nil {
		ctxLogger.Error("failed to decode team", "namespace", namespace, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	teamUID := t.Name
	teamID := deprecatedInternalID(&t)

	// Match legacy WHERE user.is_service_account = false.
	filtered := make([]iamv0alpha1.TeamTeamMember, 0, len(t.Spec.Members))
	userUIDs := make([]string, 0, len(t.Spec.Members))
	for _, member := range t.Spec.Members {
		if member.Kind != subjectKindUser {
			continue
		}
		if query.External && !member.External {
			continue
		}
		filtered = append(filtered, member)
		userUIDs = append(userUIDs, member.Name)
	}

	usersMap, err := s.listUsersByUIDs(ctx, namespace, userUIDs)
	if err != nil {
		ctxLogger.Error("failed to list users by UID", "namespace", namespace, "teamUID", teamUID, "err", err)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	members := make([]*team.TeamMemberDTO, 0, len(filtered))
	for _, member := range filtered {
		dto := &team.TeamMemberDTO{
			OrgID:      orgID,
			TeamID:     teamID,
			TeamUID:    teamUID,
			UserUID:    member.Name,
			External:   member.External,
			Permission: permissionFromMember(member.Permission),
		}

		if k8sUser, ok := usersMap[member.Name]; ok {
			dto.UserID = deprecatedInternalID(k8sUser)
			dto.Email = k8sUser.Spec.Email
			dto.Name = k8sUser.Spec.Title
			dto.Login = k8sUser.Spec.Login
			dto.AvatarURL = dtos.GetGravatarUrlWithDefault(s.cfg, k8sUser.Spec.Email, k8sUser.Spec.Login)
		}

		members = append(members, dto)
	}

	// Match legacy ORDER BY user.login, user.email.
	sort.Slice(members, func(i, j int) bool {
		if members[i].Login != members[j].Login {
			return members[i].Login < members[j].Login
		}
		return members[i].Email < members[j].Email
	})

	return members, nil
}

func (s *TeamK8sService) RegisterDelete(query string) {}

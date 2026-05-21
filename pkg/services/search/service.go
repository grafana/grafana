package search

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/search/model"
	grafanasort "github.com/grafana/grafana/pkg/services/search/sort"
	starapi "github.com/grafana/grafana/pkg/services/star/api"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/search")

func ProvideService(cfg *setting.Cfg, sqlstore db.DB, starClient starapi.K8sClients, dashboardService dashboards.DashboardService, folderService folder.Service, features featuremgmt.FeatureToggles, sortService grafanasort.Service) *SearchService {
	s := &SearchService{
		Cfg:              cfg,
		sqlstore:         sqlstore,
		starClient:       starClient,
		folderService:    folderService,
		features:         features,
		dashboardService: dashboardService,
		sortService:      sortService,
	}
	return s
}

type Query struct {
	Title         string
	Tags          []string
	OrgId         int64
	SignedInUser  *user.SignedInUser
	Limit         int64
	Page          int64
	IsStarred     bool
	IsDeleted     bool
	Type          string
	DashboardUIDs []string
	DashboardIds  []int64
	// Deprecated: use FolderUID instead
	FolderIds  []int64
	FolderUIDs []string
	Permission dashboardaccess.PermissionType
	Sort       string
}

type Service interface {
	SearchHandler(context.Context, *Query) (model.HitList, error)
	SortOptions() []model.SortOption
}

type SearchService struct {
	Cfg              *setting.Cfg
	sortService      grafanasort.Service
	sqlstore         db.DB
	starClient       starapi.K8sClients
	dashboardService dashboards.DashboardService
	folderService    folder.Service
	features         featuremgmt.FeatureToggles
}

func (s *SearchService) SearchHandler(ctx context.Context, query *Query) (model.HitList, error) {
	ctx, span := tracer.Start(ctx, "search.SearchHandler")
	defer span.End()

	// Read stars via the collections API so this works in both dual-writer
	// mode 0 (legacy SQL `star` table) and mode 5 (stars stored as a
	// `stars.collections.grafana.app` resource in unified storage).
	staredDashUIDs, err := s.getUserStars(ctx)
	if err != nil {
		return nil, err
	}

	// No starred dashboards will be found
	if query.IsStarred && len(staredDashUIDs) == 0 {
		return model.HitList{}, nil
	}

	// filter by starred dashboard IDs when starred dashboards are requested and no UID or ID filters are specified to improve query performance
	if query.IsStarred && len(query.DashboardIds) == 0 && len(query.DashboardUIDs) == 0 {
		for uid := range staredDashUIDs {
			query.DashboardUIDs = append(query.DashboardUIDs, uid)
		}
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Search).Inc()
	dashboardQuery := dashboards.FindPersistedDashboardsQuery{
		Title:         query.Title,
		SignedInUser:  query.SignedInUser,
		DashboardUIDs: query.DashboardUIDs,
		DashboardIds:  query.DashboardIds,
		Type:          query.Type,
		FolderIds:     query.FolderIds, // nolint:staticcheck
		FolderUIDs:    query.FolderUIDs,
		Tags:          query.Tags,
		Limit:         query.Limit,
		Page:          query.Page,
		Permission:    query.Permission,
		IsDeleted:     query.IsDeleted,
	}

	if sortOpt, exists := s.sortService.GetSortOption(query.Sort); exists {
		dashboardQuery.Sort = sortOpt
	}

	hits, err := s.dashboardService.SearchDashboards(ctx, &dashboardQuery)
	if err != nil {
		return nil, err
	}

	if query.Sort == "" {
		hits = sortedHits(hits)
	}

	// set starred dashboards
	for _, dashboard := range hits {
		if staredDashUIDs[dashboard.UID] {
			dashboard.IsStarred = true
		}
	}

	// filter for starred dashboards if requested
	if !query.IsStarred {
		return hits, nil
	}
	result := model.HitList{}
	for _, dashboard := range hits {
		if dashboard.IsStarred {
			result = append(result, dashboard)
		}
	}
	return result, nil
}

// getUserStars returns the current user's starred dashboard UIDs as a set.
// Stars are read through the collections API (via the K8sClients) so this
// works in both dual-writer mode 0 (legacy SQL `star` table) and mode 5
// (stars stored as a `stars.collections.grafana.app` resource in unified
// storage). The K8sClients requires a *contextmodel.ReqContext on the
// context — every production caller (/api/search) has one, and tests are
// expected to wire one up via contexthandler.CopyWithReqContext.
func (s *SearchService) getUserStars(ctx context.Context) (map[string]bool, error) {
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, fmt.Errorf("search: no request context on ctx — getUserStars requires one")
	}
	uids, err := s.starClient.GetStars(reqCtx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]bool, len(uids))
	for _, uid := range uids {
		out[uid] = true
	}
	return out, nil
}

func sortedHits(unsorted model.HitList) model.HitList {
	hits := make(model.HitList, 0, len(unsorted))
	hits = append(hits, unsorted...)

	sort.Sort(hits)

	for _, hit := range hits {
		sort.Strings(hit.Tags)
	}

	return hits
}

func (s *SearchService) RegisterSortOption(option model.SortOption) {
	s.sortService.RegisterSortOption(option)
}

func (s *SearchService) SortOptions() []model.SortOption {
	return s.sortService.SortOptions()
}

package labelsuggestion

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister, accessControl ac.AccessControl, features featuremgmt.FeatureToggles) *LabelSuggestionService {
	s := &LabelSuggestionService{
		store:         sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("label-suggestion"),
		now:           time.Now,
		queryHistory:  queryhistory.ProvideService(cfg, sqlStore, routeRegister, accessControl),
		features:      features,
	}

	if features.IsEnabled(context.Background(), featuremgmt.FlagLabelSuggestionService) {
		s.registerAPIEndpoints()
	}

	return s
}

type Service interface {
	GenerateUserLabelSuggestion(ctx context.Context, user *user.SignedInUser) (LabelSuggestionResult, error)
	GenerateDatasourceLabelSuggestion(ctx context.Context, datasourceUIDs []string) (LabelSuggestionResult, error)
	GenerateGeneralLabelSuggestion(ctx context.Context) (LabelSuggestionResult, error)
}

type LabelSuggestionService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
	queryHistory  *queryhistory.QueryHistoryService
	features      featuremgmt.FeatureToggles
}

func (s LabelSuggestionService) GenerateUserLabelSuggestion(ctx context.Context, user *user.SignedInUser) (LabelSuggestionResult, error) {
	labelExtractor := NewLabelExtractor()
	page := 0
	limit := 100

	for {
		emailQueryHistory, err := s.queryHistory.SearchInQueryHistory(ctx, user, queryhistory.SearchInQueryHistoryQuery{
			Page:  page,
			Limit: limit,
		})
		if err != nil {
			return LabelSuggestionResult{}, err
		}

		if len(emailQueryHistory.QueryHistory) == 0 {
			break
		}

		labelExtractor.extractLabels(emailQueryHistory.QueryHistory)
		// Clean up datasourceQueryHistory to save memory
		emailQueryHistory = queryhistory.QueryHistorySearchResult{}
		page++
	}

	result := LabelSuggestionResult{
		Email:       user.Email,
		CreatedAt:   time.Now().Unix(),
		Suggestions: labelExtractor.parsedLabels,
	}

	return result, nil
}

func (s LabelSuggestionService) GenerateDatasourceLabelSuggestion(ctx context.Context, datasourceUIDs []string) (LabelSuggestionResult, error) {
	labelExtractor := NewLabelExtractor()
	page := 0
	limit := 100

	for {
		datasourceQueryHistory, err := s.queryHistory.SearchInQueryHistoryAll(ctx, queryhistory.SearchInQueryHistoryQuery{
			DatasourceUIDs: datasourceUIDs,
			Page:           page,
			Limit:          limit,
		})
		if err != nil {
			return LabelSuggestionResult{}, err
		}

		if len(datasourceQueryHistory.QueryHistory) == 0 {
			break
		}

		labelExtractor.extractLabels(datasourceQueryHistory.QueryHistory)
		// Clean up datasourceQueryHistory to save memory
		datasourceQueryHistory = queryhistory.QueryHistorySearchResult{}
		page++
	}

	result := LabelSuggestionResult{
		DatasourceUIDs: datasourceUIDs,
		CreatedAt:      time.Now().Unix(),
		Suggestions:    labelExtractor.parsedLabels,
	}

	return result, nil
}

func (s LabelSuggestionService) GenerateGeneralLabelSuggestion(ctx context.Context) (LabelSuggestionResult, error) {
	labelExtractor := NewLabelExtractor()
	page := 0
	limit := 100

	for {
		allQueryHistory, err := s.queryHistory.SearchInQueryHistoryAll(ctx, queryhistory.SearchInQueryHistoryQuery{
			Page:  page,
			Limit: limit,
		})
		if err != nil {
			return LabelSuggestionResult{}, err
		}

		if len(allQueryHistory.QueryHistory) == 0 {
			break
		}

		labelExtractor.extractLabels(allQueryHistory.QueryHistory)
		// Clean up datasourceQueryHistory to save memory
		allQueryHistory = queryhistory.QueryHistorySearchResult{}
		page++
	}

	result := LabelSuggestionResult{
		CreatedAt:   time.Now().Unix(),
		Suggestions: labelExtractor.parsedLabels,
	}
	return result, nil
}

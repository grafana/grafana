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

// GenerateUserLabelSuggestion generates label suggestions based on email
func (s LabelSuggestionService) GenerateUserLabelSuggestion(ctx context.Context, user *user.SignedInUser) (LabelSuggestionResult, error) {
	emailQueryHistory, err := s.queryHistory.SearchInQueryHistory(ctx, user, queryhistory.SearchInQueryHistoryQuery{})
	if err != nil {
		return LabelSuggestionResult{}, err
	}
	parsedLabels := s.parseLabels(emailQueryHistory.QueryHistory)

	result := LabelSuggestionResult{
		Email:       user.Email,
		CreatedAt:   time.Now().Unix(),
		Suggestions: parsedLabels,
	}

	return result, nil
}

func (s LabelSuggestionService) GenerateDatasourceLabelSuggestion(ctx context.Context, datasourceUIDs []string) (LabelSuggestionResult, error) {
	datasourceQueryHistory, err := s.queryHistory.SearchInQueryHistoryAll(ctx, queryhistory.SearchInQueryHistoryQuery{DatasourceUIDs: datasourceUIDs})
	if err != nil {
		return LabelSuggestionResult{}, err
	}
	parsedLabels := s.parseLabels(datasourceQueryHistory.QueryHistory)

	result := LabelSuggestionResult{
		DatasourceUIDs: datasourceUIDs,
		CreatedAt:      time.Now().Unix(),
		Suggestions:    parsedLabels,
	}
	return result, nil
}

func (s LabelSuggestionService) GenerateGeneralLabelSuggestion(ctx context.Context) (LabelSuggestionResult, error) {
	datasourceQueryHistory, err := s.queryHistory.SearchInQueryHistoryAll(ctx, queryhistory.SearchInQueryHistoryQuery{})
	if err != nil {
		return LabelSuggestionResult{}, err
	}
	parsedLabels := s.parseLabels(datasourceQueryHistory.QueryHistory)

	result := LabelSuggestionResult{
		CreatedAt:   time.Now().Unix(),
		Suggestions: parsedLabels,
	}
	return result, nil
}

// parseLabels extracts and counts labels from query history
func (s LabelSuggestionService) parseLabels(queryHistory []queryhistory.QueryHistoryDTO) ParsedLabels {
	parsedLabels := ParsedLabels{
		LabelNames:  make(map[string]int),
		LabelValues: make(map[string]map[string]int),
	}
	for _, result := range queryHistory {
		curLabels := Extract(result.Queries)
		for lname, searches := range curLabels {
			if _, exists := parsedLabels.LabelNames[lname]; !exists {
				parsedLabels.LabelNames[lname] = 1
				parsedLabels.LabelValues[lname] = make(map[string]int)
			} else {
				parsedLabels.LabelNames[lname]++
			}
			for search := range searches {
				if _, exists := parsedLabels.LabelValues[lname][search.Value]; !exists {
					parsedLabels.LabelValues[lname][search.Value] = 1
				} else {
					parsedLabels.LabelValues[lname][search.Value]++
				}
			}
		}
	}
	return parsedLabels
}

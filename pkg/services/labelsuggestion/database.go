package labelsuggestion

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
)

// getEmailLabelSuggestion recommends labels based on email
func (s LabelSuggestionService) getUserLabelSuggestion(ctx context.Context, user *user.SignedInUser) (LabelSuggestionResult, error) {
	var hasCached bool = false
	var cachedResult LabelSuggestionResult = LabelSuggestionResult{}
	// SQL logic to pull cached stored suggestions if they are not stale
	if !hasCached {
		results, err := s.generateUserLabelSuggestion(ctx, user)
		if err != nil {
			return LabelSuggestionResult{}, err
		}
		return results, nil
	}

	return cachedResult, nil
}

func (s LabelSuggestionService) getDatasourceLabelSuggestion(ctx context.Context, datasourceUID string) (LabelSuggestionResult, error) {
	var dtos LabelSuggestionResult = LabelSuggestionResult{}
	return dtos, nil
}

func (s LabelSuggestionService) getGeneralLabelSuggestion(ctx context.Context) (LabelSuggestionResult, error) {
	var dtos LabelSuggestionResult = LabelSuggestionResult{}
	return dtos, nil
}

// generateEmailLabelSuggestion generates label suggestions based on email
func (s LabelSuggestionService) generateUserLabelSuggestion(ctx context.Context, user *user.SignedInUser) (LabelSuggestionResult, error) {
	emailQueryHistory, err := s.queryHistory.SearchInQueryHistory(ctx, user, queryhistory.SearchInQueryHistoryQuery{})
	if err != nil {
		return LabelSuggestionResult{}, err
	}
	parsedLabels := ParsedLabels{
		LabelNames:  make(map[string]int),
		LabelValues: make(map[string]map[string]int),
	}
	for _, result := range emailQueryHistory.QueryHistory {
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

	// SQL logic to store the generated suggestions

	result := LabelSuggestionResult{
		Email:       user.Email,
		CreatedAt:   time.Now().Unix(),
		Suggestions: parsedLabels,
	}

	return result, nil
}

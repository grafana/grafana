package labelsuggestion

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

// getEmailLabelSuggestion recommends labels based on email
func (s LabelSuggestionService) getUserLabelSuggestion(ctx context.Context, user *user.SignedInUser) (LabelSuggestionResult, error) {
	var hasCached bool = false
	var cachedResult LabelSuggestionResult = LabelSuggestionResult{}
	// SQL logic to pull cached stored suggestions if they are not stale
	if !hasCached {
		results, err := s.GenerateUserLabelSuggestion(ctx, user)
		if err != nil {
			return LabelSuggestionResult{}, err
		}
		// Cache the results
		return results, nil
	}

	return cachedResult, nil
}

func (s LabelSuggestionService) getDatasourceLabelSuggestion(ctx context.Context, datasourceUIDs []string) (LabelSuggestionResult, error) {
	var hasCached bool = false
	var cachedResult LabelSuggestionResult = LabelSuggestionResult{}
	// SQL logic to pull cached stored suggestions if they are not stale
	if !hasCached {
		results, err := s.GenerateDatasourceLabelSuggestion(ctx, datasourceUIDs)
		if err != nil {
			return LabelSuggestionResult{}, err
		}
		// Cache the results
		return results, nil
	}

	return cachedResult, nil
}

func (s LabelSuggestionService) getGeneralLabelSuggestion(ctx context.Context) (LabelSuggestionResult, error) {
	var hasCached bool = false
	var cachedResult LabelSuggestionResult = LabelSuggestionResult{}
	// SQL logic to pull cached stored suggestions if they are not stale
	if !hasCached {
		results, err := s.GenerateGeneralLabelSuggestion(ctx)
		if err != nil {
			return LabelSuggestionResult{}, err
		}
		// Cache the results
		return results, nil
	}

	return cachedResult, nil
}

package search

import (
	"fmt"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func ParseResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.TeamSearchResults, error) {
	if result == nil {
		return v0alpha1.TeamSearchResults{}, nil
	} else if result.Error != nil {
		return v0alpha1.TeamSearchResults{}, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	} else if result.Results == nil {
		return v0alpha1.TeamSearchResults{}, nil
	}

	titleIDX := -1

	for i, v := range result.Results.Columns {
		switch v.Name {
		case resource.SEARCH_FIELD_TITLE:
			titleIDX = i
		}
	}

	sr := v0alpha1.TeamSearchResults{
		Offset:    offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]v0alpha1.TeamHit, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		hit := &v0alpha1.TeamHit{
			Name: row.Key.Name,
		}

		if titleIDX >= 0 && row.Cells[titleIDX] != nil {
			hit.Title = string(row.Cells[titleIDX])
		} else {
			hit.Title = "(no title)"
		}

		sr.Hits[i] = *hit
	}

	return sr, nil
}

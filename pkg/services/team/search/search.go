package search

import (
	"fmt"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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

	sr := v0alpha1.TeamSearchResults{
		Offset:    offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]v0alpha1.TeamHit, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		sr.Hits[i] = v0alpha1.TeamHit{
			Name:        string(row.Cells[0]),
			Title:       string(row.Cells[1]),
			Email:       string(row.Cells[2]),
			Provisioned: string(row.Cells[3]) == "true",
			ExternalUID: string(row.Cells[4]),
		}
	}

	return sr, nil
}

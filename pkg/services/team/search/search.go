package search

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var LegacyIDField = resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID

func ParseResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.GetSearchTeamsResponse, error) {
	if result == nil {
		return v0alpha1.GetSearchTeamsResponse{}, nil
	}
	if result.Error != nil {
		return v0alpha1.GetSearchTeamsResponse{}, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	}

	switch result.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		return parseTableResults(result, offset)
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		return parseFieldValueResults(result, offset)
	default:
		return v0alpha1.GetSearchTeamsResponse{}, fmt.Errorf("unsupported search result format %d", result.GetResultFormat())
	}
}

func parseTableResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.GetSearchTeamsResponse, error) {
	if result.Results == nil {
		return v0alpha1.GetSearchTeamsResponse{}, nil
	}

	titleIDX := -1
	emailIDX := -1
	provisionedIDX := -1
	externalUIDIDX := -1
	legacyIDIDX := -1

	for i, v := range result.Results.Columns {
		if v == nil {
			continue
		}

		switch v.Name {
		case resource.SEARCH_FIELD_TITLE:
			titleIDX = i
		case builders.TEAM_SEARCH_EMAIL:
			emailIDX = i
		case builders.TEAM_SEARCH_PROVISIONED:
			provisionedIDX = i
		case builders.TEAM_SEARCH_EXTERNAL_UID:
			externalUIDIDX = i
		case LegacyIDField:
			legacyIDIDX = i
		}
	}

	sr := newSearchResponse(result, offset, len(result.Results.Rows))
	for i, row := range result.Results.Rows {
		if len(row.Cells) != len(result.Results.Columns) {
			return v0alpha1.GetSearchTeamsResponse{}, fmt.Errorf("error parsing team search response: mismatch number of columns and cells")
		}

		hit := &v0alpha1.GetSearchTeamsTeamHit{
			Name: row.Key.Name,
		}

		if titleIDX >= 0 && row.Cells[titleIDX] != nil {
			hit.Title = string(row.Cells[titleIDX])
		} else {
			hit.Title = "(no title)"
		}

		if emailIDX >= 0 && row.Cells[emailIDX] != nil {
			hit.Email = string(row.Cells[emailIDX])
		}

		if provisionedIDX >= 0 && row.Cells[provisionedIDX] != nil {
			hit.Provisioned = string(row.Cells[provisionedIDX]) == "true"
		}

		if externalUIDIDX >= 0 && row.Cells[externalUIDIDX] != nil {
			hit.ExternalUID = string(row.Cells[externalUIDIDX])
		}

		if legacyIDIDX >= 0 && row.Cells[legacyIDIDX] != nil {
			if legacyID, err := strconv.ParseInt(string(row.Cells[legacyIDIDX]), 10, 64); err == nil {
				hit.InternalId = &legacyID
			}
		}

		sr.Hits[i] = *hit
	}

	return sr, nil
}

func parseFieldValueResults(result *resourcepb.ResourceSearchResponse, offset int64) (v0alpha1.GetSearchTeamsResponse, error) {
	sr := newSearchResponse(result, offset, len(result.Rows))
	for i, row := range result.Rows {
		if row == nil || row.Key == nil {
			return v0alpha1.GetSearchTeamsResponse{}, fmt.Errorf("field-value team search result row %d has no resource key", i)
		}
		values, err := resource.DecodeSearchValues(result.Fields, row)
		if err != nil {
			return v0alpha1.GetSearchTeamsResponse{}, fmt.Errorf("decoding field-value team search result row %d: %w", i, err)
		}

		hit := &v0alpha1.GetSearchTeamsTeamHit{Name: row.Key.Name}
		if title, ok := values[resource.SEARCH_FIELD_TITLE].(string); ok {
			hit.Title = title
		} else {
			hit.Title = "(no title)"
		}
		hit.Email, _ = values[builders.TEAM_SEARCH_EMAIL].(string)
		hit.Provisioned, _ = values[builders.TEAM_SEARCH_PROVISIONED].(bool)
		hit.ExternalUID, _ = values[builders.TEAM_SEARCH_EXTERNAL_UID].(string)
		if legacyIDText, ok := values[LegacyIDField].(string); ok {
			if legacyID, err := strconv.ParseInt(legacyIDText, 10, 64); err == nil {
				hit.InternalId = &legacyID
			}
		}
		sr.Hits[i] = *hit
	}
	return sr, nil
}

func newSearchResponse(result *resourcepb.ResourceSearchResponse, offset int64, hitCount int) v0alpha1.GetSearchTeamsResponse {
	return v0alpha1.GetSearchTeamsResponse{
		GetSearchTeamsBody: v0alpha1.GetSearchTeamsBody{
			Offset:    offset,
			TotalHits: result.TotalHits,
			QueryCost: result.QueryCost,
			MaxScore:  result.MaxScore,
			Hits:      make([]v0alpha1.GetSearchTeamsTeamHit, hitCount),
		},
	}
}

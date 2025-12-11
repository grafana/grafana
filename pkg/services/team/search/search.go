package search

import (
	"encoding/binary"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
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
	emailIDX := -1
	provisionedIDX := -1
	externalUIDIDX := -1
	memberCountIDX := -1
	permissionIDX := -1
	accessControlIDX := -1

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
		case builders.TEAM_SEARCH_MEMBER_COUNT:
			memberCountIDX = i
		case builders.TEAM_SEARCH_PERMISSION:
			permissionIDX = i
		case builders.TEAM_SEARCH_ACCESS_CONTROL:
			accessControlIDX = i
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
		if len(row.Cells) != len(result.Results.Columns) {
			return v0alpha1.TeamSearchResults{}, fmt.Errorf("error parsing team search response: mismatch number of columns and cells")
		}

		hit := &v0alpha1.TeamHit{
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

		if memberCountIDX >= 0 && row.Cells[memberCountIDX] != nil {
			memberCount := binary.BigEndian.Uint64(row.Cells[memberCountIDX])
			hit.MemberCount = int64(memberCount)
		}

		if permissionIDX >= 0 && row.Cells[permissionIDX] != nil {
			permission := binary.BigEndian.Uint32(row.Cells[permissionIDX])
			hit.Permission = team.PermissionType(permission)
		}

		if accessControlIDX >= 0 && row.Cells[accessControlIDX] != nil {
			var accessControl map[string]bool
			err := json.Unmarshal(row.Cells[accessControlIDX], &accessControl)
			if err != nil {
				return v0alpha1.TeamSearchResults{}, fmt.Errorf("error parsing team search response: error unmarshalling access control: %w", err)
			}
			hit.AccessControl = accessControl
		}

		sr.Hits[i] = *hit
	}

	return sr, nil
}

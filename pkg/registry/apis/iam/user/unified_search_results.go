package user

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"time"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util"
)

func parseResults(result *resourcepb.ResourceSearchResponse) (*iamv0.GetSearchUsersResponse, error) {
	if result == nil {
		return iamv0.NewGetSearchUsersResponse(), nil
	}
	if result.Error != nil {
		return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	}

	switch result.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		return parseTableResults(result)
	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		return parseFieldValueResults(result)
	default:
		return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("unsupported search result format %d", result.GetResultFormat())
	}
}

func parseTableResults(result *resourcepb.ResourceSearchResponse) (*iamv0.GetSearchUsersResponse, error) {
	if result.Results == nil {
		return newUserSearchResponse(result, 0), nil
	}

	colIdx := make(map[string]int, len(result.Results.Columns))
	for i, v := range result.Results.Columns {
		colIdx[v.Name] = i
	}

	sr := newUserSearchResponse(result, len(result.Results.Rows))
	for i, row := range result.Results.Rows {
		if row == nil || row.Key == nil {
			return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("table user search result row %d has no resource key", i)
		}
		if len(row.Cells) != len(result.Results.Columns) {
			return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("error parsing user search response: mismatch number of columns and cells")
		}
		sr.Hits = append(sr.Hits, parseUserHit(row, colIdx))
	}

	return sr, nil
}

func parseUserHit(row *resourcepb.ResourceTableRow, colIdx map[string]int) iamv0.GetSearchUsersUserHit {
	cell := func(name string) []byte {
		if i, ok := colIdx[name]; ok {
			return row.Cells[i]
		}
		return nil
	}
	asInt64 := func(name string) int64 {
		if b := cell(name); len(b) == 8 {
			return int64(binary.BigEndian.Uint64(b))
		}
		return 0
	}

	hit := iamv0.GetSearchUsersUserHit{
		Name:    row.Key.Name,
		Title:   string(cell(resource.SEARCH_FIELD_TITLE)),
		Email:   string(cell(builders.USER_EMAIL)),
		Login:   string(cell(builders.USER_LOGIN)),
		Role:    string(cell(builders.USER_ROLE)),
		Created: asInt64(resource.SEARCH_FIELD_CREATED),
	}

	if id, err := strconv.ParseInt(string(cell(legacyIDField)), 10, 64); err == nil {
		hit.InternalId = id
	}

	if b := cell(builders.USER_DISABLED); len(b) > 0 {
		hit.Disabled = b[0] == 1
	}
	if b := cell(builders.USER_LAST_SEEN_AT); len(b) == 8 {
		hit.LastSeenAt = int64(binary.BigEndian.Uint64(b))
		hit.LastSeenAtAge = util.GetAgeString(time.Unix(hit.LastSeenAt, 0))
	}
	if b := cell(builders.USER_EXTERNAL_AUTH_MODULES); len(b) > 0 {
		var modules []string
		if err := json.Unmarshal(b, &modules); err == nil {
			hit.ExternalAuthModules = modules
		}
	}

	return hit
}

func parseFieldValueResults(result *resourcepb.ResourceSearchResponse) (*iamv0.GetSearchUsersResponse, error) {
	sr := newUserSearchResponse(result, len(result.Rows))
	for i, row := range result.Rows {
		if row == nil || row.Key == nil {
			return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("field-value user search result row %d has no resource key", i)
		}
		values, err := resource.DecodeSearchValues(result.Fields, row)
		if err != nil {
			return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("decoding field-value user search result row %d: %w", i, err)
		}

		hit := iamv0.GetSearchUsersUserHit{Name: row.Key.Name}
		hit.Title, _ = values[resource.SEARCH_FIELD_TITLE].(string)
		hit.Email, _ = values[builders.USER_EMAIL].(string)
		hit.Login, _ = values[builders.USER_LOGIN].(string)
		hit.Role, _ = values[builders.USER_ROLE].(string)
		hit.Disabled, _ = values[builders.USER_DISABLED].(bool)
		hit.ExternalAuthModules, _ = values[builders.USER_EXTERNAL_AUTH_MODULES].([]string)
		hit.Created, _ = values[resource.SEARCH_FIELD_CREATED].(int64)
		if lastSeenAt, ok := values[builders.USER_LAST_SEEN_AT].(int64); ok {
			hit.LastSeenAt = lastSeenAt
			hit.LastSeenAtAge = util.GetAgeString(time.Unix(lastSeenAt, 0))
		}
		if legacyIDText, ok := values[legacyIDField].(string); ok {
			if legacyID, err := strconv.ParseInt(legacyIDText, 10, 64); err == nil {
				hit.InternalId = legacyID
			}
		}
		sr.Hits = append(sr.Hits, hit)
	}
	return sr, nil
}

func newUserSearchResponse(result *resourcepb.ResourceSearchResponse, hitCount int) *iamv0.GetSearchUsersResponse {
	sr := iamv0.NewGetSearchUsersResponse()
	sr.TotalHits = result.TotalHits
	sr.QueryCost = result.QueryCost
	sr.MaxScore = result.MaxScore
	sr.Hits = make([]iamv0.GetSearchUsersUserHit, 0, hitCount)
	return sr
}

var bleveEscapeRegex = regexp.MustCompile(`([\\*?])`)

func escapeBleveQuery(query string) string {
	return bleveEscapeRegex.ReplaceAllString(query, `\$1`)
}

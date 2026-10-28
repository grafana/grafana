package user

import (
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
		return iamv0.NewGetSearchUsersResponse(), resource.StatusError(result.Error)
	}

	if result.GetResultFormat() != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return iamv0.NewGetSearchUsersResponse(), fmt.Errorf("unsupported search result format %d", result.GetResultFormat())
	}

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

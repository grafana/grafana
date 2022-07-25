package thumbs

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/searchV2"
)

type getDatasourceUidsForDashboard func(ctx context.Context, dashboardUid string, orgId int64) ([]string, error)

type dsUidsLookup struct {
	searchService searchV2.SearchService
	crawlerAuth   CrawlerAuth
}

func getDatasourceUIDs(resp *backend.DataResponse) ([]string, error) {
	if resp == nil {
		return nil, errors.New("nil response")
	}

	if resp.Error != nil {
		return nil, resp.Error
	}

	if len(resp.Frames) == 0 {
		return nil, errors.New("empty response")
	}

	frame := resp.Frames[0]
	field, idx := frame.FieldByName("ds_uid")

	if field.Len() == 0 || idx == -1 {
		return nil, errors.New("no ds_uid field")
	}

	rawValue, ok := field.At(0).(*json.RawMessage)
	if !ok || rawValue == nil {
		return nil, errors.New("invalid value in ds_uid field")
	}

	jsonValue, err := rawValue.MarshalJSON()
	if err != nil {
		return nil, err
	}

	var uids []string
	err = json.Unmarshal(jsonValue, &uids)
	if err != nil {
		return nil, err
	}

	return uids, nil
}

func (d *dsUidsLookup) getDatasourceUidsForDashboard(ctx context.Context, dashboardUid string, orgId int64) ([]string, error) {
	dashQueryResponse := d.searchService.DoDashboardQuery(ctx, &backend.User{
		Login: d.crawlerAuth.GetLogin(orgId),
		Role:  string(d.crawlerAuth.GetOrgRole()),
	}, orgId, searchV2.DashboardQuery{
		UIDs: []string{dashboardUid},
	})

	return getDatasourceUIDs(dashQueryResponse)
}

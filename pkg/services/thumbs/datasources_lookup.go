package thumbs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

type getDatasourceUidsForDashboard func(ctx context.Context, dashboardUid string, orgId int64) ([]string, error)

type dsUidsLookup struct {
	searchService searchV2.SearchService
	crawlerAuth   CrawlerAuth
	features      featuremgmt.FeatureToggles
}

func getDatasourceUIDs(resp *backend.DataResponse, uid string) ([]string, error) {
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
		return nil, fmt.Errorf("no ds_uid field for uid %s", uid)
	}

	rawValue, ok := field.At(0).(json.RawMessage)
	if !ok || rawValue == nil {
		return nil, fmt.Errorf("invalid value for uid %s in ds_uid field: %s", uid, field.At(0))
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

func filterOutGrafanaDs(uids []string) []string {
	filtered := make([]string, 0)
	for _, uid := range uids {
		if uid != grafanads.DatasourceUID {
			filtered = append(filtered, uid)
		}
	}

	return filtered
}

func (d *dsUidsLookup) getDatasourceUidsForDashboard(ctx context.Context, dashboardUid string, orgId int64) ([]string, error) {
	if d.searchService.IsDisabled() {
		return nil, nil
	}

	dashQueryResponse := d.searchService.DoDashboardQuery(ctx, &backend.User{
		Login: d.crawlerAuth.GetLogin(orgId),
		Role:  string(d.crawlerAuth.GetOrgRole()),
	}, orgId, searchV2.DashboardQuery{
		UIDs: []string{dashboardUid},
	})

	uids, err := getDatasourceUIDs(dashQueryResponse, dashboardUid)
	if err != nil {
		return nil, err
	}

	return filterOutGrafanaDs(uids), nil
}

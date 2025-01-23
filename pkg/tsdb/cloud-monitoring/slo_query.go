package cloudmonitoring

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func (sloQ *cloudMonitoringSLO) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, logger log.Logger) (*backend.DataResponse, any, string, error) {
	return runTimeSeriesRequest(ctx, req, s, dsInfo, sloQ.parameters.ProjectName, sloQ.params, nil, logger, sloQ.timeRange)
}

func (sloQ *cloudMonitoringSLO) parseResponse(queryRes *backend.DataResponse,
	response any, executedQueryString string, logger log.Logger) error {
	return parseTimeSeriesResponse(queryRes, response.(cloudMonitoringResponse), executedQueryString, sloQ, sloQ.params, []string{}, logger)
}

func (sloQ *cloudMonitoringSLO) buildDeepLink() string {
	return ""
}

func (sloQ *cloudMonitoringSLO) getRefID() string {
	return sloQ.refID
}

func (sloQ *cloudMonitoringSLO) getAliasBy() string {
	return sloQ.aliasBy
}

func (sloQ *cloudMonitoringSLO) getParameter(i string) string {
	switch i {
	case "project":
		return sloQ.parameters.ProjectName
	case "service":
		return sloQ.parameters.ServiceId
	case "slo":
		return sloQ.parameters.SloId
	case "selector":
		return sloQ.parameters.SelectorName
	default:
		return ""
	}
}

func (sloQ *cloudMonitoringSLO) getFilter() string {
	sloName := fmt.Sprintf("projects/%s/services/%s/serviceLevelObjectives/%s", sloQ.parameters.ProjectName, sloQ.parameters.ServiceId, sloQ.parameters.SloId)

	if sloQ.parameters.SelectorName == "select_slo_burn_rate" {
		return fmt.Sprintf(`%s("%s", "%s")`, sloQ.parameters.SelectorName, sloName, *sloQ.parameters.LookbackPeriod)
	} else {
		return fmt.Sprintf(`%s("%s")`, sloQ.parameters.SelectorName, sloName)
	}
}

func (sloQ *cloudMonitoringSLO) setParams(startTime time.Time, endTime time.Time, durationSeconds int, intervalMs int64) {
	params := url.Values{}

	params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
	params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))

	params.Add("filter", sloQ.getFilter())
	params.Add("aggregation.alignmentPeriod", calculateAlignmentPeriod(*sloQ.parameters.AlignmentPeriod, intervalMs, durationSeconds))
	if sloQ.parameters.SelectorName == "select_slo_health" {
		params.Add("aggregation.perSeriesAligner", "ALIGN_MEAN")
	} else {
		params.Add("aggregation.perSeriesAligner", "ALIGN_NEXT_OLDER")
	}
	sloQ.params = params
}

package cloudwatch

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb"
)

// returns a map of queries with query id as key. In the case a q request query
// has more than one statistic defined, one cloudwatchQuery will be created for each statistic.
// If the query doesn't have an Id defined by the user, we'll give it an with format `query[RefId]`. In the case
// the incoming query had more than one stat, it will ge an id like `query[RefId]_[StatName]`, eg queryC_Average
func (e *cloudWatchExecutor) transformRequestQueriesToCloudWatchQueries(requestQueries []*requestQuery) (
	map[string]*cloudWatchQuery, error) {
	plog.Debug("Transforming CloudWatch request queries")
	cloudwatchQueries := make(map[string]*cloudWatchQuery)
	for _, requestQuery := range requestQueries {
		for _, stat := range requestQuery.Statistics {
			id := requestQuery.Id
			if id == "" {
				id = fmt.Sprintf("query%s", requestQuery.RefId)
			}
			if len(requestQuery.Statistics) > 1 {
				id = fmt.Sprintf("%s_%v", id, strings.ReplaceAll(*stat, ".", "_"))
			}

			if _, ok := cloudwatchQueries[id]; ok {
				return nil, fmt.Errorf("error in query %q - query ID %q is not unique", requestQuery.RefId, id)
			}

			query := &cloudWatchQuery{
				Id:         id,
				RefId:      requestQuery.RefId,
				Region:     requestQuery.Region,
				Namespace:  requestQuery.Namespace,
				MetricName: requestQuery.MetricName,
				Dimensions: requestQuery.Dimensions,
				Stats:      *stat,
				Period:     requestQuery.Period,
				Alias:      requestQuery.Alias,
				Expression: requestQuery.Expression,
				ReturnData: requestQuery.ReturnData,
				MatchExact: requestQuery.MatchExact,
			}
			cloudwatchQueries[id] = query
		}
	}

	return cloudwatchQueries, nil
}

func (e *cloudWatchExecutor) transformQueryResponsesToQueryResult(cloudwatchResponses []*cloudwatchResponse, requestQueries []*requestQuery) map[string]*tsdb.QueryResult {
	responsesByRefID := make(map[string][]*cloudwatchResponse)
	refIDs := sort.StringSlice{}
	for _, res := range cloudwatchResponses {
		refIDs = append(refIDs, res.RefId)
		responsesByRefID[res.RefId] = append(responsesByRefID[res.RefId], res)
	}
	// Ensure stable results
	refIDs.Sort()

	results := make(map[string]*tsdb.QueryResult)
	for _, refID := range refIDs {
		responses := responsesByRefID[refID]
		queryResult := tsdb.NewQueryResult()
		queryResult.RefId = refID
		queryResult.Series = tsdb.TimeSeriesSlice{}
		frames := make(data.Frames, 0, len(responses))

		requestExceededMaxLimit := false
		partialData := false
		queryMeta := []struct {
			Expression, ID string
			Period         int
		}{}

		for _, response := range responses {
			addDeepLinks(refID, requestQueries, response)
			frames = append(frames, response.DataFrames...)
			requestExceededMaxLimit = requestExceededMaxLimit || response.RequestExceededMaxLimit
			partialData = partialData || response.PartialData
			queryMeta = append(queryMeta, struct {
				Expression, ID string
				Period         int
			}{
				Expression: response.Expression,
				ID:         response.Id,
				Period:     response.Period,
			})
		}

		sort.Slice(frames, func(i, j int) bool {
			return frames[i].Name < frames[j].Name
		})

		if requestExceededMaxLimit {
			queryResult.ErrorString = "Cloudwatch GetMetricData error: Maximum number of allowed metrics exceeded. Your search may have been limited."
		}
		if partialData {
			queryResult.ErrorString = "Cloudwatch GetMetricData error: Too many datapoints requested - your search has been limited. Please try to reduce the time range"
		}

		queryMetaString, err := json.Marshal(queryMeta)
		if err != nil {
			plog.Error("Could not parse meta data")
		}

		for _, frame := range frames {
			frame.Meta = &data.FrameMeta{
				ExecutedQueryString: string(queryMetaString),
			}

			for _, field := range frame.Fields {
				field.Config = &data.FieldConfig{
					Links: []data.DataLink{
						{
							Title:       "View in CloudWatch console",
							TargetBlank: true,
							URL:         u.String(), //fmt.Sprintf(`https://%s.console.aws.amazon.com/cloudwatch/deeplink.js?region=%s#metricsV2:graph=%s`, "us-east-2", "us-east-2", linkString),
						},
					},
				}
			}
		}

		queryResult.Dataframes = tsdb.NewDecodedDataFrames(frames)
		results[refID] = queryResult
	}

	return results
}

func addDeepLinks(refID string, requestQueries []*requestQuery, response *cloudwatchResponse) (string, error) {
	requestQuery := &requestQuery{}
	for _, rq := range requestQueries {
		if rq.RefId == refID {
			requestQuery = rq
			break
		}
	}

	metricItems := []interface{}{}
	cloudWatchLink := &cloudWatchLink{
		Title:   refID,
		View:    "timeSeries",
		Stacked: false,
		Region:  requestQuery.Region,
		Start:   "2021-01-06T12:15:38.084Z",
		End:     "2021-01-08T12:15:38.084Z",
	}

	if response.Expression != "" {
		cloudWatchLink.Metrics = append(cloudWatchLink.Metrics, &cloudWatchLinkMetric{Expression: response.Expression})
	}

	for _, stat := range requestQuery.Statistics {
		// if response.Expression != "" {
		// 	cloudWatchLink.Metrics = append(cloudWatchLink.Metrics, &cloudWatchLinkMetric{Expression: response.Expression})
		// } else {
		metricStat := []interface{}{requestQuery.Namespace, requestQuery.MetricName}
		for dimensionKey, dimensionValues := range requestQuery.Dimensions {
			metricStat = append(metricStat, dimensionKey, dimensionValues[0])
		}
		metricStat = append(metricStat, struct {
			stat   string
			period int
		}{
			stat:   *stat,
			period: requestQuery.Period,
		})
		// }
		metricItems = append(metricItems, metricStat)
	}
	cloudWatchLink.Metrics = metricItems

	linkString, err := json.Marshal(cloudWatchLink)
	if err != nil {
		plog.Error("Could not parse link")
	}

	u, err := url.Parse(fmt.Sprintf(`https://%s.console.aws.amazon.com/cloudwatch/deeplink.js`, requestQuery.Region))
	if err != nil {
		// slog.Error("Failed to generate deep link: unable to parse metrics explorer URL", "ProjectName", query.ProjectName, "query", query.RefID)
		// return "", nilfunc
	}

	fragment := u.Query()
	fragment.Set("metricsV2:graph", string(linkString))
	// u.Fragment = fragment.Encode()
	u.Fragment = fmt.Sprintf(`metricsV2:graph=%s`, string(linkString))

	q := u.Query()
	q.Set("region", requestQuery.Region)
	u.RawQuery = q.Encode()

	return u.String(), nil

}

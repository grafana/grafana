package cloudwatch

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

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

func (e *cloudWatchExecutor) transformQueryResponsesToQueryResult(cloudwatchResponses []*cloudwatchResponse, requestQueries []*requestQuery, startTime time.Time, endTime time.Time) (map[string]*tsdb.QueryResult, error) {
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
		executedQueries := []executedQuery{}

		for _, response := range responses {
			frames = append(frames, response.DataFrames...)
			requestExceededMaxLimit = requestExceededMaxLimit || response.RequestExceededMaxLimit
			partialData = partialData || response.PartialData
			executedQueries = append(executedQueries, executedQuery{
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

		eq, err := json.Marshal(executedQueries)
		if err != nil {
			return nil, fmt.Errorf("could not marshal executedString struct: %w", err)
		}

		link, err := buildDeepLink(refID, requestQueries, executedQueries, startTime, endTime)
		if err != nil {
			return nil, fmt.Errorf("could not build deep link: %w", err)
		}

		createDataLinks := func(link string) []data.DataLink {
			return []data.DataLink{{
				Title:       "View in CloudWatch console",
				TargetBlank: true,
				URL:         link,
			}}
		}

		for _, frame := range frames {
			frame.Meta = &data.FrameMeta{
				ExecutedQueryString: string(eq),
			}

			if link == "" || len(frame.Fields) < 2 {
				continue
			}

			if frame.Fields[1].Config == nil {
				frame.Fields[1].Config = &data.FieldConfig{}
			}

			frame.Fields[1].Config.Links = createDataLinks(link)
		}

		queryResult.Dataframes = tsdb.NewDecodedDataFrames(frames)
		results[refID] = queryResult
	}

	return results, nil
}

// buildDeepLink generates a deep link from Grafana to the CloudWatch console. The link params are based on metric(s) for a given query row in the Query Editor.
func buildDeepLink(refID string, requestQueries []*requestQuery, executedQueries []executedQuery, startTime time.Time, endTime time.Time) (string, error) {
	if isMathExpression(executedQueries) {
		return "", nil
	}

	requestQuery := &requestQuery{}
	for _, rq := range requestQueries {
		if rq.RefId == refID {
			requestQuery = rq
			break
		}
	}

	metricItems := []interface{}{}
	cloudWatchLinkProps := &cloudWatchLink{
		Title:   refID,
		View:    "timeSeries",
		Stacked: false,
		Region:  requestQuery.Region,
		Start:   startTime.UTC().Format(time.RFC3339),
		End:     endTime.UTC().Format(time.RFC3339),
	}

	expressions := []interface{}{}
	for _, meta := range executedQueries {
		if strings.Contains(meta.Expression, "SEARCH(") {
			expressions = append(expressions, &metricExpression{Expression: meta.Expression})
		}
	}

	if len(expressions) != 0 {
		cloudWatchLinkProps.Metrics = expressions
	} else {
		for _, stat := range requestQuery.Statistics {
			metricStat := []interface{}{requestQuery.Namespace, requestQuery.MetricName}
			for dimensionKey, dimensionValues := range requestQuery.Dimensions {
				metricStat = append(metricStat, dimensionKey, dimensionValues[0])
			}
			metricStat = append(metricStat, &metricStatMeta{
				Stat:   *stat,
				Period: requestQuery.Period,
			})
			metricItems = append(metricItems, metricStat)
		}
		cloudWatchLinkProps.Metrics = metricItems
	}

	linkProps, err := json.Marshal(cloudWatchLinkProps)
	if err != nil {
		return "", fmt.Errorf("could not marshal link: %w", err)
	}

	url, err := url.Parse(fmt.Sprintf(`https://%s.console.aws.amazon.com/cloudwatch/deeplink.js`, requestQuery.Region))
	if err != nil {
		return "", fmt.Errorf("unable to parse CloudWatch console deep link")
	}

	fragment := url.Query()
	fragment.Set("", string(linkProps))

	q := url.Query()
	q.Set("region", requestQuery.Region)
	url.RawQuery = q.Encode()

	link := fmt.Sprintf(`%s#metricsV2:graph%s`, url.String(), fragment.Encode())

	return link, nil
}

func isMathExpression(executedQueries []executedQuery) bool {
	isMathExpression := false
	for _, query := range executedQueries {
		if strings.Contains(query.Expression, "SEARCH(") {
			return false
		} else if query.Expression != "" {
			isMathExpression = true
		}
	}

	return isMathExpression
}

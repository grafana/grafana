package cloudwatch

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

type queryBuilderError struct {
	err   error
	RefID string
}

func (e *queryBuilderError) Error() string {
	return fmt.Sprintf("Error parsing query %s, %s", e.RefID, e.err)
}

func (e *CloudWatchExecutor) buildQueriesByRegion(queryContext *tsdb.TsdbQuery) (map[string]map[string]*CloudWatchQuery, error) {
	metricQueriesByRegion := make(map[string]map[string]*CloudWatchQuery)

	for i, model := range queryContext.Queries {
		queryType := model.Model.Get("type").MustString()
		if queryType != "timeSeriesQuery" && queryType != "" {
			continue
		}

		RefID := queryContext.Queries[i].RefId
		query, err := parseQuery(queryContext.Queries[i].Model, RefID)
		if err != nil {
			return nil, &queryBuilderError{err, RefID}
		}
		if _, ok := metricQueriesByRegion[query.Region]; !ok {
			metricQueriesByRegion[query.Region] = make(map[string]*CloudWatchQuery)
		}
		metricQueriesByRegion[query.Region][RefID] = query
	}

	return metricQueriesByRegion, nil
}

func parseQuery(model *simplejson.Json, refId string) (*CloudWatchQuery, error) {
	var target CloudWatchQuery
	data, err := model.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("Invalid query format")
	}
	json.Unmarshal(data, &target)

	// region, err := model.Get("region").String()
	// if err != nil {
	// 	return nil, err
	// }

	// namespace, err := model.Get("namespace").String()
	// if err != nil {
	// 	return nil, err
	// }

	// metricName, err := model.Get("metricName").String()
	// if err != nil {
	// 	return nil, err
	// }

	// dimensions, err := parseDimensions(model)
	// if err != nil {
	// 	return nil, err
	// }

	// statistics, err := parseStatistics(model)
	// if err != nil {
	// 	return nil, err
	// }

	target.Identifier = target.Id
	if target.Identifier == "" || len(target.Statistics) > 1 {
		target.Identifier = generateUniqueString()
	}

	p := target.Period
	if p == 0 {
		if target.Namespace == "AWS/EC2" {
			p = 300
		} else {
			p = 60
		}
	}

	var period int
	if regexp.MustCompile(`^\d+$`).Match([]byte(target.PeriodString)) {
		period, err = strconv.Atoi(target.PeriodString)
		if err != nil {
			return nil, err
		}
	} else {
		d, err := time.ParseDuration(target.PeriodString)
		if err != nil {
			return nil, err
		}
		period = int(d.Seconds())
	}
	target.Period = period
	target.PeriodString = strconv.Itoa(period)

	target.ReturnData = !target.ReturnData

	if target.QueryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		target.ReturnData = true
	}

	// return &CloudWatchQuery{
	// 	RefId:          refId,
	// 	Region:         region,
	// 	Namespace:      namespace,
	// 	MetricName:     metricName,
	// 	Dimensions:     dimensions,
	// 	Statistics:     aws.StringSlice(statistics),
	// 	Period:         period,
	// 	Alias:          alias,
	// 	Id:             id,
	// 	Identifier:     identifier,
	// 	Expression:     expression,
	// 	ReturnData:     returnData,
	// 	HighResolution: highResolution,
	// }, nil

	return &target, nil
}

func parseStatisticsAndExtendedStatistics(model *simplejson.Json) ([]string, []string, error) {
	var statistics []string
	var extendedStatistics []string

	for _, s := range model.Get("statistics").MustArray() {
		if ss, ok := s.(string); ok {
			if _, isStandard := standardStatistics[ss]; isStandard {
				statistics = append(statistics, ss)
			} else {
				extendedStatistics = append(extendedStatistics, ss)
			}
		} else {
			return nil, nil, errors.New("failed to parse")
		}
	}

	return statistics, extendedStatistics, nil
}

func parseStatistics(model *simplejson.Json) ([]string, error) {
	var statistics []string

	for _, s := range model.Get("statistics").MustArray() {
		statistics = append(statistics, s.(string))
	}

	return statistics, nil
}

func parseDimensions(model *simplejson.Json) (map[string][]string, error) {
	var result map[string][]string
	plog.Info("dimensions", "", model.Get("dimensions").MustMap())
	for k, values := range model.Get("dimensions").MustMap() {
		for _, value := range values.([]interface{}) {
			plog.Info("dimensions", "", value.([]string))

		}
		plog.Info("dimensionsK", "", k)
	}
	// 	kk := k

	// if vv, ok := v.(string); ok {
	// 	result[vv] = v.MustArray()
	// } else {
	// 	return nil, errors.New("failed to parse")
	// }
	// }

	// sort.Slice(result, func(i, j int) bool {
	// 	return *result[i].Name < *result[j].Name
	// })
	return result, nil
}

// func parseDimensions(model *simplejson.Json) ([]*cloudwatch.Dimension, error) {
// 	var result []*cloudwatch.Dimension

// 	for k, v := range model.Get("dimensions").MustMap() {
// 		kk := k
// 		if vv, ok := v.(string); ok {
// 			result = append(result, &cloudwatch.Dimension{
// 				Name:  &kk,
// 				Value: &vv,
// 			})
// 		} else {
// 			return nil, errors.New("failed to parse")
// 		}
// 	}

// 	sort.Slice(result, func(i, j int) bool {
// 		return *result[i].Name < *result[j].Name
// 	})
// 	return result, nil
// }

func generateUniqueString() string {
	var letter = []rune("abcdefghijklmnopqrstuvwxyz")

	b := make([]rune, 8)
	for i := range b {
		b[i] = letter[rand.Intn(len(letter))]
	}
	return string(b)
}

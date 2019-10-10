package cloudwatch

import (
	"context"
	"errors"
	"math/rand"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi/resourcegroupstaggingapiiface"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"golang.org/x/sync/errgroup"
)

type CloudWatchExecutor struct {
	*models.DataSource
	ec2Svc  ec2iface.EC2API
	rgtaSvc resourcegroupstaggingapiiface.ResourceGroupsTaggingAPIAPI
}

type DatasourceInfo struct {
	Profile       string
	Region        string
	AuthType      string
	AssumeRoleArn string
	Namespace     string

	AccessKey string
	SecretKey string
}

func NewCloudWatchExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &CloudWatchExecutor{}, nil
}

var (
	plog               log.Logger
	standardStatistics map[string]bool
	aliasFormat        *regexp.Regexp
)

func init() {
	plog = log.New("tsdb.cloudwatch")
	tsdb.RegisterTsdbQueryEndpoint("cloudwatch", NewCloudWatchExecutor)
	standardStatistics = map[string]bool{
		"Average":     true,
		"Maximum":     true,
		"Minimum":     true,
		"Sum":         true,
		"SampleCount": true,
	}
	aliasFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
}

func (e *CloudWatchExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	var result *tsdb.Response
	e.DataSource = dsInfo
	queryType := queryContext.Queries[0].Model.Get("type").MustString("")
	var err error

	switch queryType {
	case "metricFindQuery":
		result, err = e.executeMetricFindQuery(ctx, queryContext)
	case "annotationQuery":
		result, err = e.executeAnnotationQuery(ctx, queryContext)
	case "timeSeriesQuery":
		fallthrough
	default:
		result, err = e.executeTimeSeriesQuery(ctx, queryContext)
	}

	return result, err
}

func (e *CloudWatchExecutor) executeTimeSeriesQuery(ctx context.Context, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	results := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}
	resultChan := make(chan *tsdb.QueryResult, len(queryContext.Queries))
	eg, ectx := errgroup.WithContext(ctx)

	metricQueriesByRegion := make(map[string]map[string]*CloudWatchQuery)
	for i, model := range queryContext.Queries {
		queryType := model.Model.Get("type").MustString()
		if queryType != "timeSeriesQuery" && queryType != "" {
			continue
		}

		RefID := queryContext.Queries[i].RefId
		query, err := parseQuery(queryContext.Queries[i].Model, RefID)
		if err != nil {
			results.Results[RefID] = &tsdb.QueryResult{
				Error: err,
			}
			return results, nil
		}
		if _, ok := metricQueriesByRegion[query.Region]; !ok {
			metricQueriesByRegion[query.Region] = make(map[string]*CloudWatchQuery)
		}
		metricQueriesByRegion[query.Region][RefID] = query
	}

	if len(metricQueriesByRegion) > 0 {
		for region, getMetricDataQuery := range metricQueriesByRegion {
			q := getMetricDataQuery
			eg.Go(func() error {
				defer func() {
					if err := recover(); err != nil {
						plog.Error("Execute Get Metric Data Query Panic", "error", err, "stack", log.Stack(1))
						if theErr, ok := err.(error); ok {
							resultChan <- &tsdb.QueryResult{
								Error: theErr,
							}
						}
					}
				}()

				queryResponses, err := e.executeGetMetricDataQuery(ectx, region, q, queryContext)
				if err != nil {
					plog.Info("executeGetMetricDataQueryError", "", err)
				}
				if ae, ok := err.(awserr.Error); ok && ae.Code() == "500" {
					return err
				}
				for _, queryRes := range queryResponses {
					if err != nil {
						queryRes.Error = err
					}
					resultChan <- queryRes
				}
				return nil
			})
		}
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}
	close(resultChan)
	for result := range resultChan {
		results.Results[result.RefId] = result
	}

	return results, nil
}

func formatAlias(query *CloudWatchQuery, stat string, dimensions map[string]string, label string) string {
	region := query.Region
	namespace := query.Namespace
	metricName := query.MetricName
	period := strconv.Itoa(query.Period)
	if len(query.Id) > 0 && len(query.Expression) > 0 {
		if strings.Index(query.Expression, "SEARCH(") == 0 {
			pIndex := strings.LastIndex(query.Expression, ",")
			period = strings.Trim(query.Expression[pIndex+1:], " )")
			sIndex := strings.LastIndex(query.Expression[:pIndex], ",")
			stat = strings.Trim(query.Expression[sIndex+1:pIndex], " '")
		} else if len(query.Alias) > 0 {
			// expand by Alias
		} else {
			return query.Id
		}
	}

	data := map[string]string{}
	data["region"] = region
	data["namespace"] = namespace
	data["metric"] = metricName
	data["stat"] = stat
	data["period"] = period
	if len(label) != 0 {
		data["label"] = label
	}
	for k, v := range dimensions {
		data[k] = v
	}

	result := aliasFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := data[labelName]; exists {
			return []byte(val)
		}

		return in
	})

	if string(result) == "" {
		return metricName + "_" + stat
	}

	return string(result)
}

func parseQuery(model *simplejson.Json, refId string) (*CloudWatchQuery, error) {
	region, err := model.Get("region").String()
	if err != nil {
		return nil, err
	}

	namespace, err := model.Get("namespace").String()
	if err != nil {
		return nil, err
	}

	metricName, err := model.Get("metricName").String()
	if err != nil {
		return nil, err
	}

	id := model.Get("id").MustString("")

	expression := model.Get("expression").MustString("")

	dimensions, err := parseDimensions(model)
	if err != nil {
		return nil, err
	}

	statistics, err := parseStatistics(model)
	if err != nil {
		return nil, err
	}

	identifier := id
	if identifier == "" || len(statistics) > 1 {
		identifier = generateUniqueString()
	}

	p := model.Get("period").MustString("")
	if p == "" {
		if namespace == "AWS/EC2" {
			p = "300"
		} else {
			p = "60"
		}
	}

	var period int
	if regexp.MustCompile(`^\d+$`).Match([]byte(p)) {
		period, err = strconv.Atoi(p)
		if err != nil {
			return nil, err
		}
	} else {
		d, err := time.ParseDuration(p)
		if err != nil {
			return nil, err
		}
		period = int(d.Seconds())
	}

	alias := model.Get("alias").MustString()

	returnData := !model.Get("hide").MustBool(false)
	queryType := model.Get("type").MustString()
	if queryType == "" {
		// If no type is provided we assume we are called by alerting service, which requires to return data!
		// Note, this is sort of a hack, but the official Grafana interfaces do not carry the information
		// who (which service) called the TsdbQueryEndpoint.Query(...) function.
		returnData = true
	}
	highResolution := model.Get("highResolution").MustBool(false)

	return &CloudWatchQuery{
		RefId:          refId,
		Region:         region,
		Namespace:      namespace,
		MetricName:     metricName,
		Dimensions:     dimensions,
		Statistics:     aws.StringSlice(statistics),
		Period:         period,
		Alias:          alias,
		Id:             id,
		Identifier:     identifier,
		Expression:     expression,
		ReturnData:     returnData,
		HighResolution: highResolution,
	}, nil
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

func parseDimensions(model *simplejson.Json) ([]*cloudwatch.Dimension, error) {
	var result []*cloudwatch.Dimension

	for k, v := range model.Get("dimensions").MustMap() {
		kk := k
		if vv, ok := v.(string); ok {
			result = append(result, &cloudwatch.Dimension{
				Name:  &kk,
				Value: &vv,
			})
		} else {
			return nil, errors.New("failed to parse")
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return *result[i].Name < *result[j].Name
	})
	return result, nil
}

func generateUniqueString() string {
	var letter = []rune("abcdefghijklmnopqrstuvwxyz")

	b := make([]rune, 8)
	for i := range b {
		b[i] = letter[rand.Intn(len(letter))]
	}
	return string(b)
}

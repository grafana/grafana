package cloudmonitoring

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/huandu/xstrings"

	"github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/kinds/dataquery"
)

type (
	cloudMonitoringQueryExecutor interface {
		run(ctx context.Context, req *backend.QueryDataRequest, s *Service, dsInfo datasourceInfo, logger log.Logger) (
			*backend.DataResponse, any, string, error)
		parseResponse(dr *backend.DataResponse, data any, executedQueryString string, logger log.Logger) error
		buildDeepLink() string
		getRefID() string
		getAliasBy() string
		getParameter(i string) string
	}

	// Plugin API query data request used to generate
	// a cloudMonitoringTimeSeriesList or cloudMonitoringTimeSeriesQuery
	grafanaQuery struct {
		AliasBy         string                     `json:"aliasBy"`
		TimeSeriesList  *dataquery.TimeSeriesList  `json:"timeSeriesList,omitempty"`
		TimeSeriesQuery *dataquery.TimeSeriesQuery `json:"timeSeriesQuery,omitempty"`
		SloQuery        *dataquery.SLOQuery        `json:"sloQuery,omitempty"`
		PromQLQuery     *dataquery.PromQLQuery     `json:"promQLQuery,omitempty"`
	}

	cloudMonitoringTimeSeriesList struct {
		refID      string
		aliasBy    string
		parameters *dataquery.TimeSeriesList
		// Processed properties
		timeRange backend.TimeRange
		params    url.Values
	}
	// cloudMonitoringSLO is used to build time series with a filter but for the SLO case
	cloudMonitoringSLO struct {
		refID      string
		aliasBy    string
		parameters *dataquery.SLOQuery
		// Processed properties
		timeRange backend.TimeRange
		params    url.Values
	}

	// cloudMonitoringProm is used to build a promQL queries
	cloudMonitoringProm struct {
		refID      string
		logger     log.Logger
		aliasBy    string
		parameters *dataquery.PromQLQuery
		timeRange  backend.TimeRange
		IntervalMS int64
	}

	// cloudMonitoringTimeSeriesQuery is used to build MQL queries
	cloudMonitoringTimeSeriesQuery struct {
		refID      string
		logger     log.Logger
		aliasBy    string
		parameters *dataquery.TimeSeriesQuery
		// Processed properties
		timeRange  backend.TimeRange
		IntervalMS int64
	}

	cloudMonitoringBucketOptions struct {
		LinearBuckets *struct {
			NumFiniteBuckets int64   `json:"numFiniteBuckets"`
			Width            float64 `json:"width"`
			Offset           float64 `json:"offset"`
		} `json:"linearBuckets"`
		ExponentialBuckets *struct {
			NumFiniteBuckets int64   `json:"numFiniteBuckets"`
			GrowthFactor     float64 `json:"growthFactor"`
			Scale            float64 `json:"scale"`
		} `json:"exponentialBuckets"`
		ExplicitBuckets *struct {
			Bounds []float64 `json:"bounds"`
		} `json:"explicitBuckets"`
	}

	cloudMonitoringResponse struct {
		TimeSeries           []timeSeries         `json:"timeSeries"`
		TimeSeriesDescriptor timeSeriesDescriptor `json:"timeSeriesDescriptor"`
		TimeSeriesData       []timeSeriesData     `json:"timeSeriesData"`
		Unit                 string               `json:"unit"`
		NextPageToken        string               `json:"nextPageToken"`
	}
)

type pointIterator interface {
	length() int
	getPoint(index int) point
	metricType() string
	valueType() string
}

type point interface {
	doubleValue(descriptorIndex int) float64
	int64Value(descriptorIndex int) string
	boolValue(descriptorIndex int) bool
	bucketCounts(descriptorIndex int) []string
	bucketValue(descriptorIndex int, bucketCountIndex int) string
	bucketOptions(descriptorIndex int) cloudMonitoringBucketOptions
	endTime() time.Time
}

type timeSeriesDescriptor struct {
	LabelDescriptors []LabelDescriptor           `json:"labelDescriptors"`
	PointDescriptors []timeSeriesPointDescriptor `json:"pointDescriptors"`
}

type LabelDescriptor struct {
	Key         string `json:"key"`
	ValueType   string `json:"valueType"`
	Description string `json:"description"`
}

type timeSeriesPointDescriptor struct {
	Key        string `json:"key"`
	ValueType  string `json:"valueType"`
	MetricKind string `json:"metricKind"`
}

func (ts timeSeriesPointDescriptor) metricType() string {
	return ts.Key
}

func (ts timeSeriesPointDescriptor) valueType() string {
	return ts.ValueType
}

type timeSeriesData struct {
	LabelValues []struct {
		BoolValue   bool   `json:"boolValue"`
		Int64Value  string `json:"int64Value"`
		StringValue string `json:"stringValue"`
	} `json:"labelValues"`
	PointData []timeSeriesPointData `json:"pointData"`
}

func (ts timeSeriesData) length() int {
	return len(ts.PointData)
}

func (ts timeSeriesData) getPoint(index int) point {
	return &ts.PointData[index]
}

func (ts timeSeriesData) getLabels(labelDescriptors []LabelDescriptor) (data.Labels, string) {
	seriesLabels := make(map[string]string)
	defaultMetricName := ""

	for n, d := range labelDescriptors {
		key := xstrings.ToSnakeCase(d.Key)
		key = strings.Replace(key, ".", ".label.", 1)

		labelValue := ts.LabelValues[n]
		switch d.ValueType {
		case "BOOL":
			strVal := strconv.FormatBool(labelValue.BoolValue)
			seriesLabels[key] = strVal
		case "INT64":
			seriesLabels[key] = labelValue.Int64Value
		default:
			seriesLabels[key] = labelValue.StringValue
		}

		if strings.Contains(key, "metric.label") || strings.Contains(key, "resource.label") || strings.Contains(key, "metadata.label") {
			defaultMetricName += seriesLabels[key] + " "
		}
	}

	defaultMetricName = strings.Trim(defaultMetricName, " ")

	return seriesLabels, defaultMetricName
}

type timeSeriesDataIterator struct {
	timeSeriesData
	timeSeriesPointDescriptor
}

type timeSeriesPointData struct {
	Values       []timeSeriesPointValue `json:"values"`
	TimeInterval struct {
		EndTime   time.Time `json:"endTime"`
		StartTime time.Time `json:"startTime"`
	} `json:"timeInterval"`
}

func (point timeSeriesPointData) doubleValue(descriptorIndex int) float64 {
	return point.Values[descriptorIndex].DoubleValue
}

func (point timeSeriesPointData) int64Value(descriptorIndex int) string {
	return point.Values[descriptorIndex].IntValue
}

func (point timeSeriesPointData) boolValue(descriptorIndex int) bool {
	return point.Values[descriptorIndex].BoolValue
}

func (point timeSeriesPointData) bucketCounts(descriptorIndex int) []string {
	return point.Values[descriptorIndex].DistributionValue.BucketCounts
}

func (point timeSeriesPointData) bucketValue(descriptorIndex int, bucketCountIndex int) string {
	return point.Values[descriptorIndex].DistributionValue.BucketCounts[bucketCountIndex]
}

func (point timeSeriesPointData) bucketOptions(descriptorIndex int) cloudMonitoringBucketOptions {
	return point.Values[descriptorIndex].DistributionValue.BucketOptions
}

func (point timeSeriesPointData) endTime() time.Time {
	return point.TimeInterval.EndTime
}

type timeSeries struct {
	Metric struct {
		Labels map[string]string `json:"labels"`
		Type   string            `json:"type"`
	} `json:"metric"`
	Resource struct {
		Type   string            `json:"type"`
		Labels map[string]string `json:"labels"`
	} `json:"resource"`
	MetaData   map[string]map[string]any `json:"metadata"`
	MetricKind string                    `json:"metricKind"`
	ValueType  string                    `json:"valueType"`
	Points     []timeSeriesPoint         `json:"points"`
}

func (ts timeSeries) length() int {
	return len(ts.Points)
}

func (ts timeSeries) getPoint(index int) point {
	return &ts.Points[index]
}

func (ts timeSeries) metricType() string {
	return ts.Metric.Type
}

func (ts timeSeries) valueType() string {
	return ts.ValueType
}

func (ts timeSeries) getLabels(groupBys []string) (data.Labels, string) {
	seriesLabels := data.Labels{}
	defaultMetricName := ts.Metric.Type
	seriesLabels["resource.type"] = ts.Resource.Type
	groupBysMap := make(map[string]bool)
	for _, groupBy := range groupBys {
		groupBysMap[groupBy] = true
	}

	for key, value := range ts.Metric.Labels {
		seriesLabels["metric.label."+key] = value

		if len(groupBys) == 0 || groupBysMap["metric.label."+key] {
			defaultMetricName += " " + value
		}
	}

	for key, value := range ts.Resource.Labels {
		seriesLabels["resource.label."+key] = value

		if groupBysMap["resource.label."+key] {
			defaultMetricName += " " + value
		}
	}

	for labelType, labelTypeValues := range ts.MetaData {
		for labelKey, labelValue := range labelTypeValues {
			key := xstrings.ToSnakeCase(fmt.Sprintf("metadata.%s.%s", labelType, labelKey))

			switch v := labelValue.(type) {
			case string:
				seriesLabels[key] = v
			case bool:
				strVal := strconv.FormatBool(v)
				seriesLabels[key] = strVal
			case []any:
				for _, v := range v {
					strVal := v.(string)
					if len(seriesLabels[key]) > 0 {
						strVal = fmt.Sprintf("%s, %s", seriesLabels[key], strVal)
					}
					seriesLabels[key] = strVal
				}
			}
		}
	}

	return seriesLabels, defaultMetricName
}

type timeSeriesPoint struct {
	Interval struct {
		StartTime time.Time `json:"startTime"`
		EndTime   time.Time `json:"endTime"`
	} `json:"interval"`
	Value timeSeriesPointValue `json:"value"`
}

type timeSeriesPointValue struct {
	DoubleValue       float64 `json:"doubleValue"`
	StringValue       string  `json:"stringValue"`
	BoolValue         bool    `json:"boolValue"`
	IntValue          string  `json:"int64Value"`
	DistributionValue struct {
		Count                 string  `json:"count"`
		Mean                  float64 `json:"mean"`
		SumOfSquaredDeviation float64 `json:"sumOfSquaredDeviation"`
		Range                 struct {
			Min int `json:"min"`
			Max int `json:"max"`
		} `json:"range"`
		BucketOptions cloudMonitoringBucketOptions `json:"bucketOptions"`
		BucketCounts  []string                     `json:"bucketCounts"`
		Examplars     []struct {
			Value     float64 `json:"value"`
			Timestamp string  `json:"timestamp"`
			// attachments
		} `json:"examplars"`
	} `json:"distributionValue"`
}

func (point timeSeriesPoint) doubleValue(descriptorIndex int) float64 {
	return point.Value.DoubleValue
}

func (point timeSeriesPoint) int64Value(descriptorIndex int) string {
	return point.Value.IntValue
}

func (point timeSeriesPoint) boolValue(descriptorIndex int) bool {
	return point.Value.BoolValue
}

func (point timeSeriesPoint) bucketCounts(descriptorIndex int) []string {
	return point.Value.DistributionValue.BucketCounts
}

func (point timeSeriesPoint) bucketValue(descriptorIndex int, bucketCountIndex int) string {
	return point.Value.DistributionValue.BucketCounts[bucketCountIndex]
}

func (point timeSeriesPoint) bucketOptions(descriptorIndex int) cloudMonitoringBucketOptions {
	return point.Value.DistributionValue.BucketOptions
}

func (point timeSeriesPoint) endTime() time.Time {
	return point.Interval.EndTime
}

type metricDescriptorResponse struct {
	Descriptors []metricDescriptor `json:"metricDescriptors"`
	Token       string             `json:"nextPageToken"`
}
type metricDescriptor struct {
	ValueType        string `json:"valueType"`
	MetricKind       string `json:"metricKind"`
	Type             string `json:"type"`
	Unit             string `json:"unit"`
	Service          string `json:"service"`
	ServiceShortName string `json:"serviceShortName"`
	DisplayName      string `json:"displayName"`
	Description      string `json:"description"`
}

type projectResponse struct {
	Projects []projectDescription `json:"projects"`
	Token    string               `json:"nextPageToken"`
}

type projectDescription struct {
	ProjectID string `json:"projectId"`
	Name      string `json:"name"`
}

type serviceResponse struct {
	Services []serviceDescription `json:"services"`
	Token    string               `json:"nextPageToken"`
}
type serviceDescription struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
}

type sloResponse struct {
	SLOs  []sloDescription `json:"serviceLevelObjectives"`
	Token string           `json:"nextPageToken"`
}

type sloDescription struct {
	Name        string  `json:"name"`
	DisplayName string  `json:"displayName"`
	Goal        float64 `json:"goal"`
}

type selectableValue struct {
	Value string  `json:"value"`
	Label string  `json:"label"`
	Goal  float64 `json:"goal,omitempty"`
}

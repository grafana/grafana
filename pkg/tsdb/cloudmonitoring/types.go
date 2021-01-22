package cloudmonitoring

import (
	"context"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

type (
	cloudMonitoringQueryExecutor interface {
		run(ctx context.Context, tsdbQuery *tsdb.TsdbQuery, e *CloudMonitoringExecutor) (*tsdb.QueryResult, cloudMonitoringResponse, string, error)
		parseResponse(queryRes *tsdb.QueryResult, data cloudMonitoringResponse, executedQueryString string) error
		parseToAnnotations(queryRes *tsdb.QueryResult, data cloudMonitoringResponse, title string, text string, tags string) error
		buildDeepLink() string
		getRefID() string
		getUnit() string
	}

	// Used to build time series filters
	cloudMonitoringTimeSeriesFilter struct {
		Target      string
		Params      url.Values
		RefID       string
		GroupBys    []string
		AliasBy     string
		ProjectName string
		Selector    string
		Service     string
		Slo         string
		Unit        string
	}

	// Used to build MQL queries
	cloudMonitoringTimeSeriesQuery struct {
		RefID       string
		ProjectName string
		Query       string
		IntervalMS  int64
		AliasBy     string
		timeRange   *tsdb.TimeRange
		Unit        string
	}

	metricQuery struct {
		ProjectName        string
		MetricType         string
		CrossSeriesReducer string
		AlignmentPeriod    string
		PerSeriesAligner   string
		GroupBys           []string
		Filters            []string
		AliasBy            string
		View               string
		EditorMode         string
		Query              string
		Unit               string
	}

	sloQuery struct {
		ProjectName      string
		AlignmentPeriod  string
		PerSeriesAligner string
		AliasBy          string
		SelectorName     string
		ServiceId        string
		SloId            string
	}

	grafanaQuery struct {
		DatasourceId int
		RefId        string
		QueryType    string
		MetricQuery  metricQuery
		SloQuery     sloQuery
	}

	cloudMonitoringBucketOptions struct {
		LinearBuckets *struct {
			NumFiniteBuckets int64 `json:"numFiniteBuckets"`
			Width            int64 `json:"width"`
			Offset           int64 `json:"offset"`
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
		TimeSeriesData       timeSeriesData       `json:"timeSeriesData"`
	}
)

type timeSeriesDescriptor struct {
	LabelDescriptors []struct {
		Key         string `json:"key"`
		ValueType   string `json:"valueType"`
		Description string `json:"description"`
	} `json:"labelDescriptors"`
	PointDescriptors []struct {
		Key        string `json:"key"`
		ValueType  string `json:"valueType"`
		MetricKind string `json:"metricKind"`
	} `json:"pointDescriptors"`
}

type timeSeriesData []struct {
	LabelValues []struct {
		BoolValue   bool   `json:"boolValue"`
		Int64Value  int64  `json:"int64Value"`
		StringValue string `json:"stringValue"`
	} `json:"labelValues"`
	PointData []struct {
		Values []struct {
			BoolValue         bool    `json:"boolValue"`
			Int64Value        string  `json:"int64Value"`
			DoubleValue       float64 `json:"doubleValue"`
			StringValue       string  `json:"stringValue"`
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
		} `json:"values"`
		TimeInterval struct {
			EndTime   time.Time `json:"endTime"`
			StartTime time.Time `json:"startTime"`
		} `json:"timeInterval"`
	} `json:"pointData"`
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
	MetaData   map[string]map[string]interface{} `json:"metadata"`
	MetricKind string                            `json:"metricKind"`
	ValueType  string                            `json:"valueType"`
	Points     []struct {
		Interval struct {
			StartTime time.Time `json:"startTime"`
			EndTime   time.Time `json:"endTime"`
		} `json:"interval"`
		Value struct {
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
		} `json:"value"`
	} `json:"points"`
}

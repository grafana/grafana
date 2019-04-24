package stackdriver

import (
	"net/url"
	"time"
)

// StackdriverQuery is the query that Grafana sends from the frontend
type StackdriverQuery struct {
	Target   string
	Params   url.Values
	RefID    string
	GroupBys []string
	AliasBy  string
}

type StackdriverBucketOptions struct {
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

// StackdriverResponse is the data returned from the external Google Stackdriver API
type StackdriverResponse struct {
	TimeSeries []struct {
		Metric struct {
			Labels map[string]string `json:"labels"`
			Type   string            `json:"type"`
		} `json:"metric"`
		Resource struct {
			Type   string            `json:"type"`
			Labels map[string]string `json:"labels"`
		} `json:"resource"`
		MetricKind string `json:"metricKind"`
		ValueType  string `json:"valueType"`
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
					BucketOptions StackdriverBucketOptions `json:"bucketOptions"`
					BucketCounts  []string                 `json:"bucketCounts"`
					Examplars     []struct {
						Value     float64 `json:"value"`
						Timestamp string  `json:"timestamp"`
						// attachments
					} `json:"examplars"`
				} `json:"distributionValue"`
			} `json:"value"`
		} `json:"points"`
	} `json:"timeSeries"`
}

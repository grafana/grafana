package elasticsearch

import (
	"github.com/grafana/grafana/pkg/tsdb"
)

type EsQuery struct {
        RefId string `json:"refId"`
        Alias string `json:"alias"`
        DsType string `json:"dsType"`
        TimeField string `json:"timeField"`
        Query string `json:"query"`
        Metrics []EsMetric `json:"metrics"`
        BucketAggs []EsBucketAgg `json:"bucketAggs"`
        DataSource *tsdb.DataSourceInfo
}

type EsMetric struct {
        Id string `json:"id"`
        MetricType string `json:"type"`
        Field string `json:"field"`
        Meta EsMetricMeta `json:"meta"`
        Hide bool `json:"hide"`
        Settings EsMetricSettings `json:"settings"`
        InlineScript string `json:"inlineScript"`
        PipelineAgg string `json:"pipelineAgg"`
}

type EsMetricMeta struct {
        Count bool `json:"count"`
        Min bool `json:"min"`
        Max bool `json:"max"`
        Avg bool `json:"avg"`
        Sum bool `json:"sum"`
        SumOfSquares bool `json:"sum_of_squares"`
        Variance bool `json:"variance"`
        StdDeviation bool `json:"std_deviation"`
}

type EsMetricSettings struct {
        Script EsScript `json:"script"`
        PrecisionThreshold string `json:"precision_threshold"`
        Percentiles []string `json:"percents,string"`
        Sigma int64 `json:"sigma"`
        Model string `json:"model"`
        Window int `json:"window"`
}

type EsScript struct {
        Inline string `json:"inline"`
}

type EsBucketAgg struct {
        Id string `json:"id"`
        AggType string `json:"type"`
        Field string `json:"field"`
        Settings EsAggSettings `json:"settings"`
}

type EsAggSettings struct {
        Interval string `json:"interval"`
        MinDocCount int64 `json:"min_doc_count"`
        TrimEdges int64 `json:"trimEdges"`
        Order string `json:"order"`
        OrderBy string `json:"orderBy"`
        Size string `json:"size"`
}

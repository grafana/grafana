package elasticsearch

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/components/simplejson"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/instrumentation"
)

const (
	// Metric types
	countType         = "count"
	percentilesType   = "percentiles"
	extendedStatsType = "extended_stats"
	topMetricsType    = "top_metrics"
	// Bucket types
	dateHistType    = "date_histogram"
	nestedType      = "nested"
	histogramType   = "histogram"
	filtersType     = "filters"
	termsType       = "terms"
	geohashGridType = "geohash_grid"
	//  Document types
	rawDocumentType = "raw_document"
	rawDataType     = "raw_data"
	// Logs type
	logsType = "logs"
)

var searchWordsRegex = regexp.MustCompile(regexp.QuoteMeta(es.HighlightPreTagsString) + `(.*?)` + regexp.QuoteMeta(es.HighlightPostTagsString))
var aliasPatternRegex = regexp.MustCompile(`\{\{([\s\S]+?)\}\}`)

func parseResponse(ctx context.Context, responses []*es.SearchResponse, targets []*Query, configuredFields es.ConfiguredFields, keepLabelsInResponse bool, logger log.Logger) (*backend.QueryDataResponse, error) {
	result := backend.QueryDataResponse{
		Responses: backend.Responses{},
	}
	if responses == nil {
		return &result, nil
	}
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.elastic.parseResponse", trace.WithAttributes(
		attribute.Int("responseLength", len(responses)),
	))
	defer span.End()

	// Create processors
	logsProcessor := newLogsResponseProcessor(logger)
	rawProcessor := newRawResponseProcessor(logger)
	metricsProcessor := newMetricsResponseProcessor()

	for i, res := range responses {
		_, resSpan := tracing.DefaultTracer().Start(ctx, "datasource.elastic.parseResponse.response", trace.WithAttributes(
			attribute.String("queryMetricType", targets[i].Metrics[0].Type),
		))
		start := time.Now()
		target := targets[i]

		if res.Error != nil {
			mt, _ := json.Marshal(target)
			me, _ := json.Marshal(res.Error)
			resSpan.RecordError(errors.New(string(me)))
			resSpan.SetStatus(codes.Error, string(me))
			resSpan.End()
			logger.Error("Processing error response from Elasticsearch", "error", string(me), "query", string(mt))
			errResult := getErrorFromElasticResponse(res)
			result.Responses[target.RefID] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(errors.New(errResult)))
			continue
		}

		queryRes := backend.DataResponse{}

		if isRawDataQuery(target) {
			err := rawProcessor.processRawDataResponse(res, target, configuredFields, &queryRes)
			if err != nil {
				// TODO: This error never happens so we should remove it
				return &backend.QueryDataResponse{}, err
			}
			result.Responses[target.RefID] = queryRes
		} else if isRawDocumentQuery(target) {
			err := rawProcessor.processRawDocumentResponse(res, target, &queryRes)
			if err != nil {
				// TODO: This error never happens so we should remove it
				return &backend.QueryDataResponse{}, err
			}
			result.Responses[target.RefID] = queryRes
		} else if isLogsQuery(target) {
			err := logsProcessor.processLogsResponse(res, target, configuredFields, &queryRes)
			if err != nil {
				// TODO: This error never happens so we should remove it
				return &backend.QueryDataResponse{}, err
			}
			result.Responses[target.RefID] = queryRes
		} else {
			// Process as metric query result
			props := make(map[string]string)
			err := metricsProcessor.processBuckets(res.Aggregations, target, &queryRes, props, 0)
			logger.Debug("Processed metric query response")
			if err != nil {
				mt, _ := json.Marshal(target)
				span.RecordError(err)
				span.SetStatus(codes.Error, err.Error())
				resSpan.RecordError(err)
				resSpan.SetStatus(codes.Error, err.Error())
				logger.Error("Error processing buckets", "error", err, "query", string(mt), "aggregationsLength", len(res.Aggregations), "stage", es.StageParseResponse)
				instrumentation.UpdatePluginParsingResponseDurationSeconds(ctx, time.Since(start), "error")
				resSpan.End()
				return &backend.QueryDataResponse{}, err
			}
			nameFields(queryRes, target, keepLabelsInResponse)
			trimDatapoints(queryRes, target)

			result.Responses[target.RefID] = queryRes
		}
		instrumentation.UpdatePluginParsingResponseDurationSeconds(ctx, time.Since(start), "ok")
		logger.Info("Finished processing of response", "duration", time.Since(start), "stage", es.StageParseResponse)
		resSpan.End()
	}
	return &result, nil
}

// getErrorFromElasticResponse extracts error message from Elasticsearch error response
func getErrorFromElasticResponse(response *es.SearchResponse) string {
	var errorString string
	json := simplejson.NewFromAny(response.Error)
	reason := json.Get("reason").MustString()
	rootCauseReason := json.Get("root_cause").GetIndex(0).Get("reason").MustString()
	causedByReason := json.Get("caused_by").Get("reason").MustString()

	switch {
	case rootCauseReason != "":
		errorString = rootCauseReason
	case reason != "":
		errorString = reason
	case causedByReason != "":
		errorString = causedByReason
	default:
		errorString = "Unknown elasticsearch error response"
	}

	return errorString
}

// setPreferredVisType sets the preferred visualization type for a frame
func setPreferredVisType(frame *data.Frame, visType data.VisType) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.PreferredVisualization = visType
}

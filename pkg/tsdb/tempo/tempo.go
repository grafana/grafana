package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"

	jaeger "github.com/jaegertracing/jaeger/model"
	jaeger_json "github.com/jaegertracing/jaeger/model/converter/json"

	ot_pdata "go.opentelemetry.io/collector/consumer/pdata"
	ot_jaeger "go.opentelemetry.io/collector/translator/trace/jaeger"
)

type tempoExecutor struct {
	httpClient *http.Client
}

func NewExecutor(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &tempoExecutor{
		httpClient: httpClient,
	}, nil
}

var (
	tlog = log.New("tsdb.tempo")
)

func (e *tempoExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	queryContext plugins.DataQuery) (plugins.DataResponse, error) {
	refID := queryContext.Queries[0].RefID
	queryResult := plugins.DataQueryResult{}

	traceID := queryContext.Queries[0].Model.Get("query").MustString("")

	tlog.Debug("Querying tempo with traceID", "traceID", traceID)

	req, err := http.NewRequestWithContext(ctx, "GET", dsInfo.Url+"/api/traces/"+traceID, nil)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	req.Header.Set("Accept", "application/protobuf")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			tlog.Warn("failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		queryResult.Error = fmt.Errorf("failed to get trace: %s", traceID)
		tlog.Error("Request to tempo failed", "Status", resp.Status, "Body", string(body))
		return plugins.DataResponse{
			Results: map[string]plugins.DataQueryResult{
				refID: queryResult,
			},
		}, nil
	}

	otTrace := ot_pdata.NewTraces()
	err = otTrace.FromOtlpProtoBytes(body)
	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	jaegerBatches, err := ot_jaeger.InternalTracesToJaegerProto(otTrace)
	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed to translate to jaegerBatches %v: %w", traceID, err)
	}

	jaegerTrace := &jaeger.Trace{
		Spans:      []*jaeger.Span{},
		ProcessMap: []jaeger.Trace_ProcessMapping{},
	}

	// otel proto conversion doesn't set jaeger processes
	for _, batch := range jaegerBatches {
		for _, s := range batch.Spans {
			s.Process = batch.Process
		}

		jaegerTrace.Spans = append(jaegerTrace.Spans, batch.Spans...)
		jaegerTrace.ProcessMap = append(jaegerTrace.ProcessMap, jaeger.Trace_ProcessMapping{
			Process:   *batch.Process,
			ProcessID: batch.Process.ServiceName,
		})
	}
	jsonTrace := jaeger_json.FromDomain(jaegerTrace)

	traceBytes, err := json.Marshal(jsonTrace)
	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed to json.Marshal trace \"%s\" :%w", traceID, err)
	}

	frames := []*data.Frame{
		{Name: "Traces", RefID: refID, Fields: []*data.Field{data.NewField("trace", nil, []string{string(traceBytes)})}},
	}
	queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)

	return plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{
			refID: queryResult,
		},
	}, nil
}

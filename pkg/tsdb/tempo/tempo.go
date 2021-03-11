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
	"github.com/grafana/grafana/pkg/tsdb"

	jaeger "github.com/jaegertracing/jaeger/model"
	jaeger_json "github.com/jaegertracing/jaeger/model/converter/json"

	ot_pdata "go.opentelemetry.io/collector/consumer/pdata"
	ot_jaeger "go.opentelemetry.io/collector/translator/trace/jaeger"
)

type tempoExecutor struct {
	httpClient *http.Client
}

// NewExecutor returns a tempoExecutor.
func NewExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	httpClient, err := dsInfo.GetHttpClient()
	if err != nil {
		return nil, err
	}

	return &tempoExecutor{
		httpClient: httpClient,
	}, nil
}

var (
	tlog log.Logger
)

func init() {
	tlog = log.New("tsdb.tempo")
	tsdb.RegisterTsdbQueryEndpoint("tempo", NewExecutor)
}

func (e *tempoExecutor) Query(ctx context.Context, dsInfo *models.DataSource,
	queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	refID := queryContext.Queries[0].RefId
	queryResult := &tsdb.QueryResult{}
	traceID := queryContext.Queries[0].Model.Get("query").MustString("")

	req, err := e.createRequest(ctx, dsInfo, traceID)
	if err != nil {
		return nil, err
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			tlog.Warn("failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		queryResult.ErrorString = fmt.Sprintf("failed to get trace with id: %s Status: %s Body: %s", traceID, resp.Status, string(body))
		return &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				refID: queryResult,
			},
		}, nil
	}

	otTrace := ot_pdata.NewTraces()
	err = otTrace.FromOtlpProtoBytes(body)
	if err != nil {
		return nil, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	jaegerBatches, err := ot_jaeger.InternalTracesToJaegerProto(otTrace)
	if err != nil {
		return nil, fmt.Errorf("failed to translate to jaegerBatches %v: %w", traceID, err)
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
		return nil, fmt.Errorf("failed to json.Marshal trace \"%s\" :%w", traceID, err)
	}

	frames := []*data.Frame{
		{Name: "Traces", RefID: refID, Fields: []*data.Field{data.NewField("trace", nil, []string{string(traceBytes)})}},
	}
	queryResult.Dataframes = tsdb.NewDecodedDataFrames(frames)

	return &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			refID: queryResult,
		},
	}, nil
}

func (e *tempoExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource, traceID string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", dsInfo.Url+"/api/traces/"+traceID, nil)
	if err != nil {
		return nil, err
	}

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	req.Header.Set("Accept", "application/protobuf")

	tlog.Debug("Tempo request", "url", req.URL.String(), "headers", req.Header)
	return req, nil
}

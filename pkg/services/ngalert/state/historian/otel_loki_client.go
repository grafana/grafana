package historian

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/unknwon/log"
	"github.com/valyala/bytebufferpool"
	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/plog"
	"go.opentelemetry.io/collector/pdata/plog/plogotlp"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

var (
	_            remoteLokiClient = (*otelLokiClient)(nil)
	payloadsPool                  = bytebufferpool.Pool{}
)

type OtelConfig struct {
	Enabled       bool
	WriteTimeout  time.Duration
	Endpoint      string
	EnableTLS     bool
	TLSSkipVerify bool
	ApiKey        string
}

func (c OtelConfig) HttpMode() bool {
	u, err := url.Parse(c.Endpoint)
	if err != nil {
		return false
	}

	return u.Scheme == "http" || u.Scheme == "https"
}

func (c OtelConfig) GetWriteTimeout() time.Duration {
	const writeTimeoutDefault = 5 * time.Second
	if c.WriteTimeout == 0 {
		return writeTimeoutDefault
	}

	return c.WriteTimeout
}

type otelLokiClient struct {
	grpcClient plogotlp.GRPCClient
	httpClient *http.Client
	once       *sync.Once
	cfg        OtelConfig
	metrics    *metrics.Historian
	httpMode   bool
}

func NewOtelLokiClient(cfg OtelConfig, metrics *metrics.Historian) *otelLokiClient {
	return &otelLokiClient{
		once:     &sync.Once{},
		cfg:      cfg,
		metrics:  metrics,
		httpMode: cfg.HttpMode(),
	}
}

func (p *otelLokiClient) Ping(context.Context) error {
	return nil
}

func (p *otelLokiClient) RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (QueryRes, error) {
	return QueryRes{}, fmt.Errorf("unsupported operation")
}

func (p *otelLokiClient) initClient() (err error) {
	p.once.Do(func() {
		if p.httpMode {
			err = p.initHTTPClient(p.cfg)
			return
		}

		err = p.initGrpcClient(p.cfg)
	})

	if err != nil {
		return fmt.Errorf("failed to create otel loki client: %w", err)
	}

	return nil
}

func (p *otelLokiClient) initGrpcClient(cfg OtelConfig) error {
	conn, err := newOtlpGrpcConn(cfg)
	if err != nil {
		return err
	}

	p.grpcClient = plogotlp.NewGRPCClient(conn)
	return nil
}

func (p *otelLokiClient) initHTTPClient(cfg OtelConfig) error {
	p.httpClient = &http.Client{
		Transport: getOTLPHTTPConnectionTransport(cfg),
	}
	return nil
}

func (p *otelLokiClient) Push(ctx context.Context, s []Stream) (err error) {
	const (
		exportGRPCMethodName = "otelExportGRPC"
		exportHTTPMethodName = "otelExportHTTP"
	)

	exportStart := time.Now()
	logs, size, err := p.pushRequestToLogs(s, time.Now())
	if err != nil {
		return err
	}

	timeoutCtx, cancelFunc := context.WithTimeout(ctx, p.cfg.GetWriteTimeout())
	defer cancelFunc()

	req := plogotlp.NewExportRequestFromLogs(logs)

	var status string
	var method string
	if p.httpMode {
		method = exportHTTPMethodName
		p.metrics.WriteDuration.Before(ctx, exportHTTPMethodName, exportStart)
		status, err = p.pushHttp(timeoutCtx, &req)
	} else {
		method = exportGRPCMethodName
		p.metrics.WriteDuration.Before(ctx, exportGRPCMethodName, exportStart)
		status, err = p.pushGrpc(timeoutCtx, &req)
	}

	if err != nil {
		return fmt.Errorf("failed to export logs: %w", err)
	}

	p.metrics.WriteDuration.After(ctx, method, status, exportStart)
	p.metrics.BytesWritten.Add(float64(size))
	return nil
}

func (p *otelLokiClient) pushHttp(ctx context.Context, req *plogotlp.ExportRequest) (status string, err error) {
	const (
		contentTypeHeader   = "Content-Type"
		apiKeyHeader        = "apikey"
		protobufContentType = "application/x-protobuf"
		contentEncoding     = "Content-Encoding"
		contentEncodingGzip = "gzip"
	)

	err = p.initClient()
	if err != nil {
		return "", err
	}

	protoBody, err := req.MarshalProto()
	if err != nil {
		return "", fmt.Errorf("failed to marshal logs: %w", err)
	}

	gzippedBuffer := payloadsPool.Get()
	defer payloadsPool.Put(gzippedBuffer)

	gzipWriter := gzip.NewWriter(gzippedBuffer)
	_, err = gzipWriter.Write(protoBody)
	if err != nil {
		return "", fmt.Errorf("failed to gzip request: %w", err)
	}

	err = gzipWriter.Close()
	if err != nil {
		return "", fmt.Errorf("failed to close the gzip writer: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.cfg.Endpoint, bytes.NewReader(gzippedBuffer.Bytes()))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set(contentEncoding, contentEncodingGzip)
	httpReq.Header.Set(contentTypeHeader, protobufContentType)
	if p.cfg.ApiKey != "" {
		httpReq.Header.Set(apiKeyHeader, p.cfg.ApiKey)
	}

	response, err := p.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("failed to send http request: %w", err)
	}

	defer response.Body.Close()
	return strconv.Itoa(response.StatusCode), nil
}

func (p *otelLokiClient) pushGrpc(ctx context.Context, req *plogotlp.ExportRequest) (status string, err error) {
	const (
		failureCode = "1"
		successCode = "0"
	)

	err = p.initClient()
	if err != nil {
		return "", err
	}

	_, err = p.grpcClient.Export(ctx, *req)
	if err != nil {
		return failureCode, err
	}

	return successCode, nil
}

func (p *otelLokiClient) pushRequestToLogs(sreams []Stream, observedTimestamp time.Time) (plog.Logs, int, error) {
	logs := plog.NewLogs()
	if len(sreams) == 0 {
		return logs, 0, nil
	}
	rls := logs.ResourceLogs().AppendEmpty()
	logSlice := rls.ScopeLogs().AppendEmpty().LogRecords()
	totalSize := 0

	var lastErr error
	var errNumber int64
	for _, stream := range sreams {
		// Return early if stream does not contain any entries
		if len(stream.Stream) == 0 {
			continue
		}

		totalSize += calcAttributesSize(stream.Stream)

		for _, entry := range stream.Values {
			lr := logSlice.AppendEmpty()
			convertEntryToLogRecord(entry, stream.Stream, &lr, observedTimestamp)
			totalSize += len(entry.V)
		}
	}

	if lastErr != nil {
		lastErr = fmt.Errorf("%d entries failed to process, the last error: %w", errNumber, lastErr)
	}

	return logs, totalSize, lastErr
}

func convertEntryToLogRecord(entry Sample, streamAttributes map[string]string, lr *plog.LogRecord, defaultTimestamp time.Time) error {
	const timestampAttribute = "timestamp"

	observedTimestamp := pcommon.NewTimestampFromTime(defaultTimestamp)
	lr.SetObservedTimestamp(observedTimestamp)

	var recordAttributes map[string]any
	err := json.Unmarshal([]byte(entry.V), &recordAttributes)
	if err != nil {
		return fmt.Errorf("failed to unmarshal log line: %w", err)
	}

	var timestamp pcommon.Timestamp
	if !entry.T.IsZero() {
		timestamp = pcommon.NewTimestampFromTime(entry.T)
	} else {
		timestamp = observedTimestamp
	}

	lr.SetTimestamp(timestamp)
	lr.Attributes().FromRaw(recordAttributes)
	attributes := lr.Attributes()
	attributes.PutStr(timestampAttribute, timestamp.AsTime().Format(time.RFC3339Nano))
	for k, v := range streamAttributes {
		attributes.PutStr(k, v)
	}

	return nil
}

func calcAttributesSize(attributes map[string]string) int {
	size := 0
	for k, v := range attributes {
		size += len(k) + len(v)
	}
	return size
}

func newOtlpGrpcConn(cfg OtelConfig) (conn *grpc.ClientConn, err error) {
	const (
		apiKeyHeader                 = "apikey"
		defaultConnectionDialTimeout = 10 * time.Second
	)
	creds := insecure.NewCredentials()
	if cfg.EnableTLS {
		config := &tls.Config{
			InsecureSkipVerify: cfg.TLSSkipVerify,
		}
		creds = credentials.NewTLS(config)
		log.Info("Establishing grpcs connection")
	} else {
		log.Info("Establishing not encrypted grpc connection")
	}

	options := []grpc.DialOption{
		grpc.WithTransportCredentials(creds),
	}

	if cfg.ApiKey != "" {
		options = append(options, grpc.WithUnaryInterceptor(func(ctx context.Context, method string, req interface{}, reply interface{},
			cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {

			ctx = metadata.AppendToOutgoingContext(ctx, apiKeyHeader, cfg.ApiKey)
			return invoker(ctx, method, req, reply, cc, opts...)
		}))
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultConnectionDialTimeout)
	defer cancel()
	return grpc.DialContext(ctx, cfg.Endpoint, options...)
}

func getOTLPHTTPConnectionTransport(otelConfig OtelConfig) *http.Transport {
	if otelConfig.EnableTLS {
		return &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: otelConfig.TLSSkipVerify,
			},
		}
	}

	return &http.Transport{}
}

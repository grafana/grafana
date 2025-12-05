package es

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// requestEncoder handles encoding of search requests to Elasticsearch format
type requestEncoder struct {
	logger log.Logger
}

// newRequestEncoder creates a new request encoder
func newRequestEncoder(logger log.Logger) *requestEncoder {
	return &requestEncoder{
		logger: logger,
	}
}

// encodeBatchRequests encodes multiple requests into NDJSON format
func (e *requestEncoder) encodeBatchRequests(requests []*multiRequest) ([]byte, error) {
	start := time.Now()

	payload := bytes.Buffer{}
	for _, r := range requests {
		reqHeader, err := json.Marshal(r.header)
		if err != nil {
			return nil, err
		}
		payload.WriteString(string(reqHeader) + "\n")

		reqBody, err := json.Marshal(r.body)
		if err != nil {
			return nil, err
		}

		body := string(reqBody)
		body = strings.ReplaceAll(body, "$__interval_ms", strconv.FormatInt(r.interval.Milliseconds(), 10))
		body = strings.ReplaceAll(body, "$__interval", r.interval.String())

		payload.WriteString(body + "\n")
	}

	elapsed := time.Since(start)
	e.logger.Debug("Completed encoding of batch requests to json", "duration", elapsed)

	return payload.Bytes(), nil
}

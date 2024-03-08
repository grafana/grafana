package querydata

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querydata/exemplar"
)

func TestQueryData_parseResponse(t *testing.T) {
	qd := QueryData{exemplarSampler: exemplar.NewStandardDeviationSampler}

	t.Run("resultType is before result the field must parsed normally", func(t *testing.T) {
		resBody := `{"data":{"resultType":"vector", "result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res, false)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("resultType is after the result field must parsed normally", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":"vector"},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res, false)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("unGzip response data", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":"vector"},"status":"success"}`
		bytsBody := []byte(resBody)
		buffer := bytes.NewBuffer(make([]byte, 0, 1024))
		gzipW := gzip.NewWriter(buffer)
		_, err := gzipW.Write(bytsBody)
		assert.Nil(t, err)
		err = gzipW.Close()
		assert.Nil(t, err)
		res := &http.Response{Body: io.NopCloser(bytes.NewBuffer(buffer.Bytes()))}
		res.Header = make(http.Header)
		res.Header.Add("Content-Encoding", "gzip")
		result := qd.parseResponse(context.Background(), &models.Query{}, res, false)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("no resultType is existed in the data", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res, false)
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "no resultType found")
	})

	t.Run("resultType is set as empty string before result", func(t *testing.T) {
		resBody := `{"data":{"resultType":"", "result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res, false)
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "unknown result type: ")
	})

	t.Run("resultType is set as empty string after result", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":""},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res, false)
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "unknown result type: ")
	})
}

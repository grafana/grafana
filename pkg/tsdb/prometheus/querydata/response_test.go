package querydata

import (
	"bytes"
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
		result, err := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, err)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("resultType is after the result field must parsed normally", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":"vector"},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result, err := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, err)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("no resultType is existed in the data", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result, _ := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Equal(t, 0, len(result.Frames))
	})

	t.Run("resultType is set as empty string before result", func(t *testing.T) {
		resBody := `{"data":{"resultType":"", "result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result, err := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Equal(t, err.Error(), "unknown result type: ")
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "unknown result type: ")
	})

	t.Run("resultType is set as empty string after result", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":""},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result, err := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Equal(t, err.Error(), "unknown result type: ")
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "unknown result type: ")
	})
}

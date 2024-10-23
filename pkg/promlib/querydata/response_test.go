package querydata

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/promlib/querydata/exemplar"
)

func TestQueryData_parseResponse(t *testing.T) {
	qd := QueryData{exemplarSampler: exemplar.NewStandardDeviationSampler}

	t.Run("resultType is before result the field must parsed normally", func(t *testing.T) {
		resBody := `{"data":{"resultType":"vector", "result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("resultType is after the result field must parsed normally", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":"vector"},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("no resultType is existed in the data", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "no resultType found")
	})

	t.Run("resultType is set as empty string before result", func(t *testing.T) {
		resBody := `{"data":{"resultType":"", "result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}]},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "unknown result type: ")
	})

	t.Run("resultType is set as empty string after result", func(t *testing.T) {
		resBody := `{"data":{"result":[{"metric":{"__name__":"some_name","environment":"some_env","id":"some_id","instance":"some_instance:1234","job":"some_job","name":"another_name","region":"some_region"},"value":[1.1,"2"]}],"resultType":""},"status":"success"}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Error(t, result.Error)
		assert.Equal(t, result.Error.Error(), "unknown result type: ")
	})
}

func TestAddMetadataToMultiFrame(t *testing.T) {
	t.Run("when you have native histogram result", func(t *testing.T) {
		qd := QueryData{exemplarSampler: exemplar.NewStandardDeviationSampler}
		resBody := `{"status":"success","data":{"resultType":"matrix","result":[{"metric":{"__name__":"rpc_durations_native_histogram_seconds","instance":"nativehisto:8080","job":"prometheus"},"histograms":[[1729529685,{"count":"7243102","sum":"72460202.93145595","buckets":[[0,"1.8340080864093422","2","10"],[0,"2","2.1810154653305154","68"]]}],[1729529700,{"count":"7243490","sum":"72464056.03309634","buckets":[[0,"1.8340080864093422","2","10"],[0,"2","2.1810154653305154","68"]]}],[1729529715,{"count":"7243880","sum":"72467935.35871512","buckets":[[0,"1.8340080864093422","2","10"],[0,"2","2.1810154653305154","68"]]}]]}]}}`
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(resBody))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
		assert.Equal(t, "yMin", result.Frames[0].Fields[1].Name)
	})
}

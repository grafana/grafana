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
	gr := "{\"data\":{\"resultType\":\"vector\", \"result\":[{\"metric\":{\"__name__\":\"some_name\",\"environment\":\"some_env\",\"id\":\"some_id\",\"instance\":\"some_instance:1234\",\"job\":\"some_job\",\"name\":\"another_name\",\"region\":\"some_region\"},\"value\":[1.1,\"2\"]}]},\"status\":\"success\"}"
	br := "{\"data\":{\"result\":[{\"metric\":{\"__name__\":\"some_name\",\"environment\":\"some_env\",\"id\":\"some_id\",\"instance\":\"some_instance:1234\",\"job\":\"some_job\",\"name\":\"another_name\",\"region\":\"some_region\"},\"value\":[1.1,\"2\"]}],\"resultType\":\"vector\"},\"status\":\"success\"}"

	t.Run("resultType is before result the field must parsed normally", func(t *testing.T) {

		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(gr))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})

	t.Run("resultType is after the result field must parsed normally", func(t *testing.T) {
		res := &http.Response{Body: io.NopCloser(bytes.NewBufferString(br))}
		result := qd.parseResponse(context.Background(), &models.Query{}, res)
		assert.Nil(t, result.Error)
		assert.Len(t, result.Frames, 1)
	})
}

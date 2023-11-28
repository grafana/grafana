package ml

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/slices"

	"github.com/grafana/grafana/pkg/api/response"
)

func TestOutlierExec(t *testing.T) {
	outlier := OutlierCommand{
		config: OutlierCommandConfiguration{
			DatasourceType: "prometheus",
			DatasourceUID:  "a4ce599c-4c93-44b9-be5b-76385b8c01be",
			QueryParams: map[string]any{
				"expr":  "go_goroutines{}",
				"range": true,
				"refId": "A",
			},
			Algorithm: map[string]any{
				"name": "dbscan",
				"config": map[string]any{
					"epsilon": 7.667,
				},
				"sensitivity": 0.83,
			},
			ResponseType: "binary",
		},
		appURL:   "https://grafana.com",
		interval: 1000 * time.Second,
	}

	t.Run("should generate expected parameters for request", func(t *testing.T) {
		to := time.Now().UTC()
		from := to.Add(-10 * time.Hour)

		called := false
		_, err := outlier.Execute(from, to, func(method string, path string, payload []byte) (response.Response, error) {
			require.Equal(t, "POST", method)
			require.Equal(t, "/proxy/api/v1/outlier", path)

			assert.JSONEq(t, fmt.Sprintf(`{
			  "data": {
			    "attributes": {
			      "datasource_type": "prometheus",
			      "datasource_uid": "a4ce599c-4c93-44b9-be5b-76385b8c01be",
			      "query_params": {
			        "expr": "go_goroutines{}",
			        "range": true,
			        "refId": "A"
			      },
			      "algorithm": {
			        "config": {
			          "epsilon": 7.667
			        },
			        "name": "dbscan",
			        "sensitivity": 0.83
			      },
			      "response_type": "binary",
			      "grafana_url": "https://grafana.com",
			      "start_end_attributes": {
			        "start": "%s",
			        "end": "%s",
			        "interval": 1000000
			      }
			    }
			  }
			}`, from.Format(timeFormat), to.Format(timeFormat)), string(payload))

			called = true
			return nil, nil
		})
		require.Truef(t, called, "request function was not called")
		require.ErrorContains(t, err, "response is nil")
	})

	successResponse := `{"status":"success","data":{"results":{"A":{"status":200,"frames":[{"schema":{"name":"test","fields":[{"name":"Time","type":"time","typeInfo":{"frame":"time.Time"}},{"name":"Value","type":"number","typeInfo":{"frame":"float64"},"labels":{"instance":"test"}}]},"data":{"values":[[1686945300000],[0]]}}]}}}}`

	testCases := []struct {
		name     string
		response response.Response
		assert   func(t *testing.T, r *backend.QueryDataResponse, err error)
	}{
		{
			name:     "should return parsed frames when 200",
			response: response.CreateNormalResponse(nil, []byte(successResponse), http.StatusOK),
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.NoError(t, err)
				require.NotNil(t, r)
				require.Contains(t, r.Responses, "A")
				require.NoError(t, r.Responses["A"].Error)
				require.Equal(t, backend.StatusOK, r.Responses["A"].Status)
				require.Len(t, r.Responses["A"].Frames, 1)
			},
		},
		{
			name:     "should return nil if 204",
			response: response.CreateNormalResponse(nil, []byte(`{"status": "success"}`), http.StatusNoContent),
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.NoError(t, err)
				require.Nil(t, r)
			},
		},
		{
			name:     "should return error if any status and body has status error",
			response: response.CreateNormalResponse(nil, []byte(`{"status": "error"}`), 0),
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.ErrorContains(t, err, "ML API responded with error")
				require.Nil(t, r)
			},
		},
		{
			name:     "should return error with explanations if any status and body has status error",
			response: response.CreateNormalResponse(nil, []byte(`{"status": "error", "error": "test-error"}`), 0),
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.ErrorContains(t, err, "ML API responded with error")
				require.ErrorContains(t, err, "test-error")
				require.Nil(t, r)
			},
		},
		{
			name:     "should return error response is empty",
			response: response.CreateNormalResponse(nil, []byte(``), 0),
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.ErrorContains(t, err, "unexpected format of the response from ML API")
				require.Nil(t, r)
			},
		},
		{
			name:     "should return error response is not a valid JSON",
			response: response.CreateNormalResponse(nil, []byte(`{`), 0),
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.ErrorContains(t, err, "unexpected format of the response from ML API")
				require.Nil(t, r)
			},
		},
		{
			name:     "should error if response is nil and no error",
			response: nil,
			assert: func(t *testing.T, r *backend.QueryDataResponse, err error) {
				require.ErrorContains(t, err, "response is nil")
				require.Nil(t, r)
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			to := time.Now()
			from := to.Add(-10 * time.Hour)

			resp, err := outlier.Execute(from, to, func(method string, path string, payload []byte) (response.Response, error) {
				return tc.response, nil
			})
			tc.assert(t, resp, err)
		})
	}

	t.Run("should return error if status is not known", func(t *testing.T) {
		knownStatuses := []int{http.StatusOK, http.StatusNoContent}

		for status := 100; status < 600; status++ {
			if http.StatusText(status) == "" || slices.Contains(knownStatuses, status) {
				continue
			}
			to := time.Now()
			from := to.Add(-10 * time.Hour)

			resp, err := outlier.Execute(from, to, func(method string, path string, payload []byte) (response.Response, error) {
				return response.CreateNormalResponse(nil, []byte(successResponse), status), nil
			})
			require.ErrorContains(t, err, fmt.Sprintf("unexpected status %d returned by ML API", status))
			require.Nil(t, resp)
		}
	})

	t.Run("should propagate error from request function", func(t *testing.T) {
		to := time.Now()
		from := to.Add(-10 * time.Hour)

		resp, err := outlier.Execute(from, to, func(method string, path string, payload []byte) (response.Response, error) {
			return nil, errors.New("test-error")
		})
		require.ErrorContains(t, err, "test-error")
		require.Nil(t, resp)
	})
}

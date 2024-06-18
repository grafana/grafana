package loggermw

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/web"
)

func Test_sanitizeURI(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		want        string
		expectError bool
	}{
		{
			name:  "Receiving empty string should return it",
			input: "",
			want:  "",
		},
		{
			name:  "Receiving URL with auth_token should remove it",
			input: "https://grafana.com/?auth_token=secret-token&q=1234",
			want:  "https://grafana.com/?auth_token=hidden&q=1234",
		},
		{
			name:  "Receiving presigned URL from AWS should remove signature",
			input: "https://s3.amazonaws.com/finance-department-bucket/2022/tax-certificate.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3SGQVQG7FGA6KKA6%2F20221104%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20221104T140227Z&X-Amz-Expires=3600&X-Amz-Signature=b22&X-Amz-SignedHeaders=host",
			want:  "https://s3.amazonaws.com/finance-department-bucket/2022/tax-certificate.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA3SGQVQG7FGA6KKA6%2F20221104%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20221104T140227Z&X-Amz-Expires=3600&X-Amz-Signature=hidden&X-Amz-SignedHeaders=host",
		},
		{
			name:  "Receiving presigned URL from GCP should remove signature",
			input: "https://storage.googleapis.com/example-bucket/cat.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example%40example-project.iam.gserviceaccount.com%2F20181026%2Fus-central1%2Fstorage%2Fgoog4_request&X-Goog-Date=20181026T181309Z&X-Goog-Expires=900&X-Goog-Signature=247a&X-Goog-SignedHeaders=host",
			want:  "https://storage.googleapis.com/example-bucket/cat.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=example%40example-project.iam.gserviceaccount.com%2F20181026%2Fus-central1%2Fstorage%2Fgoog4_request&X-Goog-Date=20181026T181309Z&X-Goog-Expires=900&X-Goog-Signature=hidden&X-Goog-SignedHeaders=host",
		},
		{
			name:  "Receiving presigned URL from Azure should remove signature",
			input: "https://myaccount.queue.core.windows.net/myqueue/messages?se=2015-07-02T08%3A49Z&si=YWJjZGVmZw%3D%3D&sig=jDrr6cna7JPwIaxWfdH0tT5v9dc%3d&sp=p&st=2015-07-01T08%3A49Z&sv=2015-02-21&visibilitytimeout=120",
			want:  "https://myaccount.queue.core.windows.net/myqueue/messages?se=2015-07-02T08%3A49Z&si=YWJjZGVmZw%3D%3D&sig=hidden&sp=p&st=2015-07-01T08%3A49Z&sv=2015-02-21&visibilitytimeout=120",
		},
		{
			name:  "Receiving valid URL string should return it parsed",
			input: "https://grafana.com/?sig=testing-a-generic-parameter",
			want:  "https://grafana.com/?sig=testing-a-generic-parameter",
		},
		{
			name:        "Receiving invalid URL string should return empty string",
			input:       "this is not a valid URL",
			want:        "",
			expectError: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url, err := SanitizeURI(tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equalf(t, tt.want, url, "SanitizeURI(%v)", tt.input)
		})
	}
}

func Test_prepareLog(t *testing.T) {
	type opts struct {
		Features      []any
		RouterLogging bool
	}

	grafanaFlavoredErr := errutil.NotFound("test.notFound").Errorf("got error")

	tests := []struct {
		name     string
		opts     opts
		req      *http.Request
		response web.ResponseWriter
		duration time.Duration
		error    error

		expectFields  map[string]any
		expectAbsence map[string]struct{}
		expectedLevel errutil.LogLevel
	}{
		{
			name:     "base case",
			req:      mustRequest(http.NewRequest(http.MethodGet, "/", nil)),
			response: mockResponseWriter{},

			expectFields: map[string]any{
				"method":      "GET",
				"path":        "/",
				"status":      0,
				"remote_addr": "",
				"time_ms":     0,
				"duration":    "0s",
				"size":        0,
				"referer":     "",
			},
			expectAbsence: map[string]struct{}{
				"error":         {},
				"db_call_count": {},
			},
		},
		{
			name:     "base case",
			req:      mustRequest(http.NewRequest(http.MethodGet, "/", nil)),
			response: mockResponseWriter{},

			expectFields: map[string]any{
				"method":      "GET",
				"path":        "/",
				"status":      0,
				"remote_addr": "",
				"time_ms":     0,
				"duration":    "0s",
				"size":        0,
				"referer":     "",
			},
			expectAbsence: map[string]struct{}{
				"error":         {},
				"db_call_count": {},
			},
			expectedLevel: errutil.LevelInfo,
		},
		{
			name: "regular Go error",
			req:  mustRequest(http.NewRequest(http.MethodGet, "/", nil)),
			response: mockResponseWriter{
				status: http.StatusInternalServerError,
			},
			error: fmt.Errorf("got an error"),

			expectFields: map[string]any{
				"status": http.StatusInternalServerError,
				"error":  "got an error",
			},
			expectAbsence: map[string]struct{}{
				"errorReason":    {},
				"errorMessageID": {},
			},
			expectedLevel: errutil.LevelError,
		},
		{
			name: "Grafana-style error",
			req:  mustRequest(http.NewRequest(http.MethodGet, "/", nil)),
			response: mockResponseWriter{
				status: http.StatusNotFound,
			},
			error: grafanaFlavoredErr,
			expectFields: map[string]any{
				"status":         http.StatusNotFound,
				"error":          "got error",
				"errorReason":    errutil.StatusNotFound,
				"errorMessageID": "test.notFound",
			},
			expectedLevel: errutil.LevelInfo,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RouterLogging = tc.opts.RouterLogging
			l := Provide(cfg, featuremgmt.WithFeatures(tc.opts.Features...))

			service, ok := l.(*loggerImpl)
			require.Truef(t, ok, "expected service to be of type (*loggerImpl), got (%T)", l)

			c := &contextmodel.ReqContext{
				Context: &web.Context{
					Req:  tc.req,
					Resp: tc.response,
				},
				Error: tc.error,
			}

			logs, level := service.prepareLogParams(c, tc.duration)

			require.Zero(t, len(logs)%2, "Each key must have an accompanying value")
			kv := map[any]any{}
			for i := 0; i < len(logs); i += 2 {
				kv[logs[i]] = logs[i+1]
			}

			for key, val := range tc.expectFields {
				assert.Contains(t, kv, key)
				if val != nil {
					assert.EqualValues(t, val, kv[key])
				}
			}
			for key := range tc.expectAbsence {
				assert.NotContains(t, kv, key)
			}

			if tc.expectedLevel != "" {
				assert.Equal(t, tc.expectedLevel, level)
			}
		})
	}
}

func mustRequest(r *http.Request, err error) *http.Request {
	if err != nil {
		panic(fmt.Errorf("expected no error when creating request, got: %w", err))
	}
	return r
}

type mockResponseWriter struct {
	web.ResponseWriter

	status int
	size   int
}

func (m mockResponseWriter) Status() int {
	return m.status
}
func (m mockResponseWriter) Size() int {
	return m.size
}

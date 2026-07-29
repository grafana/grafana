package ofrep

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

func TestProxyUserAgent(t *testing.T) {
	tests := []struct {
		name              string
		namespace         string
		expectedUserAgent string
	}{
		{
			name:              "sets namespace-scoped user agent",
			namespace:         "stacks-1234",
			expectedUserAgent: "features-grafana-app/stacks-1234",
		},
		{
			name:              "falls back to service name when namespace is empty",
			namespace:         "",
			expectedUserAgent: "features-grafana-app",
		},
	}

	newUARecordingServer := func(t *testing.T) (*httptest.Server, *string) {
		t.Helper()
		var receivedUA string
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedUA = r.Header.Get("User-Agent")
			_, _ = io.WriteString(w, `{"flags":[]}`)
		}))
		t.Cleanup(srv.Close)
		return srv, &receivedUA
	}

	t.Run("single flag", func(t *testing.T) {
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				upstream, receivedUA := newUARecordingServer(t)
				b := newTestBuilder(t, upstream.URL)
				w := httptest.NewRecorder()
				r := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/myflag", strings.NewReader(`{}`))
				b.proxyFlagReq(r.Context(), "myflag", true, tc.namespace, w, r)
				assert.Equal(t, tc.expectedUserAgent, *receivedUA)
			})
		}
	})

	t.Run("all flags", func(t *testing.T) {
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				upstream, receivedUA := newUARecordingServer(t)
				b := newTestBuilder(t, upstream.URL)
				w := httptest.NewRecorder()
				r := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", strings.NewReader(`{}`))
				b.proxyAllFlagReq(r.Context(), true, tc.namespace, w, r)
				assert.Equal(t, tc.expectedUserAgent, *receivedUA)
			})
		}
	})
}

func TestProxyAllFlagReq_Filtering(t *testing.T) {
	flagsByMetadata := []goffmodel.OFREPFlagBulkEvaluateSuccessResponse{
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{
			Key: "publicBool", Value: true, Metadata: map[string]any{"public": true},
		}},
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{
			Key: "publicString", Value: true, Metadata: map[string]any{"public": "true"},
		}},
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{
			Key: "privateBool", Value: true, Metadata: map[string]any{"public": false},
		}},
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{
			Key: "noMetadata", Value: true,
		}},
	}
	onlyPrivateFlag := []goffmodel.OFREPFlagBulkEvaluateSuccessResponse{
		{OFREPEvaluateSuccessResponse: goffmodel.OFREPEvaluateSuccessResponse{
			Key: "privateBool", Metadata: map[string]any{"public": false},
		}},
	}

	tests := []struct {
		name           string
		filteringOn    bool
		isAuthedUser   bool
		upstreamFlags  []goffmodel.OFREPFlagBulkEvaluateSuccessResponse
		upstreamStatus int
		wantStatus     int
		wantKeys       []string
	}{
		{
			name:           "flag on, authenticated: bulk response is filtered down to public-metadata flags only",
			filteringOn:    true,
			isAuthedUser:   true,
			upstreamFlags:  flagsByMetadata,
			upstreamStatus: http.StatusOK,
			wantStatus:     http.StatusOK,
			wantKeys:       []string{"publicBool", "publicString"},
		},
		{
			name:           "flag on, unauthenticated: bulk response is filtered down to public-metadata flags only",
			filteringOn:    true,
			isAuthedUser:   false,
			upstreamFlags:  flagsByMetadata,
			upstreamStatus: http.StatusOK,
			wantStatus:     http.StatusOK,
			wantKeys:       []string{"publicBool", "publicString"},
		},
		{
			name:           "flag off, authenticated: bulk response is not filtered at all",
			filteringOn:    false,
			isAuthedUser:   true,
			upstreamFlags:  flagsByMetadata,
			upstreamStatus: http.StatusOK,
			wantStatus:     http.StatusOK,
			wantKeys:       []string{"publicBool", "publicString", "privateBool", "noMetadata"},
		},
		{
			name:           "flag off, unauthenticated: bulk response is still filtered down to public-metadata flags (unauth is always gated)",
			filteringOn:    false,
			isAuthedUser:   false,
			upstreamFlags:  flagsByMetadata,
			upstreamStatus: http.StatusOK,
			wantStatus:     http.StatusOK,
			wantKeys:       []string{"publicBool", "publicString"},
		},
		{
			name:           "flag on: a non-200 response from the provider is passed through unfiltered, not decoded",
			filteringOn:    true,
			isAuthedUser:   true,
			upstreamFlags:  nil,
			upstreamStatus: http.StatusInternalServerError,
			wantStatus:     http.StatusInternalServerError,
		},
		{
			name:           "flag on: if every flag gets filtered out, the response still has a valid (non-null) empty flags list",
			filteringOn:    true,
			isAuthedUser:   true,
			upstreamFlags:  onlyPrivateFlag,
			upstreamStatus: http.StatusOK,
			wantStatus:     http.StatusOK,
			wantKeys:       []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagFeaturesBulkFlagEvalFiltering, tt.filteringOn)
			b := newBulkEvalBuilder(t, tt.upstreamFlags, tt.upstreamStatus)
			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags", strings.NewReader(`{}`))

			b.proxyAllFlagReq(r.Context(), tt.isAuthedUser, "", w, r)

			assert.Equal(t, tt.wantStatus, w.Code)
			if tt.wantStatus != http.StatusOK {
				return
			}
			var result goffmodel.OFREPBulkEvaluateSuccessResponse
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
			assert.NotNil(t, result.Flags)
			assert.ElementsMatch(t, tt.wantKeys, flagKeys(result.Flags))
		})
	}
}

func TestProxyFlagReq_Filtering(t *testing.T) {
	tests := []struct {
		name         string
		flagKey      string
		metadata     map[string]any
		isAuthedUser bool
		wantStatus   int
	}{
		{
			name:       "unauthenticated request for a flag marked public in its metadata succeeds",
			flagKey:    "publicflag",
			metadata:   map[string]any{"public": true},
			wantStatus: http.StatusOK,
		},
		{
			name:       "unauthenticated request for a flag without public metadata is rejected with 404, indistinguishable from a genuinely missing flag",
			flagKey:    "secretflag",
			wantStatus: http.StatusNotFound,
		},
		{
			name:         "authenticated request succeeds even without public metadata",
			flagKey:      "secretflag",
			isAuthedUser: true,
			wantStatus:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newSingleEvalBuilder(t, tt.metadata)
			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodPost, "/ofrep/v1/evaluate/flags/"+tt.flagKey, strings.NewReader(`{}`))

			b.proxyFlagReq(r.Context(), tt.flagKey, tt.isAuthedUser, "", w, r)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusNotFound {
				var result goffmodel.OFREPEvaluateErrorResponse
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
				assert.Equal(t, tt.flagKey, result.Key)
				assert.EqualValues(t, "FLAG_NOT_FOUND", result.ErrorCode)
			}
		})
	}
}

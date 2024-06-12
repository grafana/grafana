package filters

import (
	"context"
	"net/http"
	"net/http/httptest"
	"runtime/pprof"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestWithProfilingLabels(t *testing.T) {
	t.Run("No stack id in namespace shouldn't add label", func(t *testing.T) {
		var actualReq *http.Request
		h := WithProfilingLabels(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			actualReq = req
			w.WriteHeader(http.StatusOK)
		}))

		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "http://", nil))

		require.NotNil(t, actualReq)
		_, exists := pprof.Label(actualReq.Context(), "stack_id")
		require.False(t, exists)
	})

	t.Run("Stack id in namespace should add label", func(t *testing.T) {
		var actualReq *http.Request
		h := WithProfilingLabels(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			actualReq = req
			w.WriteHeader(http.StatusOK)
		}))

		ctx := request.WithRequestInfo(context.Background(), &request.RequestInfo{Namespace: "stack-123"})
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://", nil)
		require.NoError(t, err)

		h.ServeHTTP(httptest.NewRecorder(), req)

		require.NotNil(t, actualReq)
		v, exists := pprof.Label(actualReq.Context(), "stack_id")
		require.True(t, exists)
		require.Equal(t, "123", v)
	})
}

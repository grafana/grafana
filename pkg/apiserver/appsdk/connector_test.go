package appsdk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
)

func TestHandlerWrapper_Errors(t *testing.T) {
	for _, tc := range []struct {
		name    string
		err     error
		code    int
		reason  metav1.StatusReason
		message string
	}{
		{"plain error", errors.New("boom"), http.StatusInternalServerError, metav1.StatusReasonInternalError, "boom"},
		{"status error", apierrors.NewBadRequest("invalid input"), http.StatusBadRequest, metav1.StatusReasonBadRequest, "invalid input"},
		{"wrapped status error", fmt.Errorf("route failed: %w", apierrors.NewBadRequest("invalid input")), http.StatusBadRequest, metav1.StatusReasonBadRequest, "invalid input"},
		{"zero status code", &apierrors.StatusError{ErrStatus: metav1.Status{Message: "missing code"}}, http.StatusInternalServerError, metav1.StatusReasonInternalError, "missing code"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := handlerWrapper{
				handler:   func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error { return tc.err },
				urlToPath: func(u *url.URL) string { return u.Path },
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/foo", nil))
			assert.Equal(t, tc.code, w.Code)
			assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
			var status metav1.Status
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &status))
			assert.Equal(t, metav1.TypeMeta{Kind: "Status", APIVersion: "v1"}, status.TypeMeta)
			assert.Equal(t, metav1.StatusFailure, status.Status)
			assert.Equal(t, int32(tc.code), status.Code)
			assert.Equal(t, tc.reason, status.Reason)
			assert.Equal(t, tc.message, status.Message)
		})
	}
}

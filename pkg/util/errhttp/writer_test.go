package errhttp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

func TestWrite(t *testing.T) {
	// Error without k8s context
	recorder, returnedStatusCode := doError(t, context.Background())
	assert.Equal(t, http.StatusGatewayTimeout, recorder.Code)
	assert.Equal(t, http.StatusGatewayTimeout, returnedStatusCode)
	assert.JSONEq(t, `{"message": "Timeout", "messageId": "test.thisIsExpected", "statusCode": 504}`, recorder.Body.String())

	// Another request, but within the k8s framework
	recorder, returnedStatusCode = doError(t, request.WithRequestInfo(context.Background(), &request.RequestInfo{
		APIGroup: "TestGroup",
	}))
	assert.Equal(t, http.StatusGatewayTimeout, recorder.Code)
	assert.Equal(t, http.StatusGatewayTimeout, returnedStatusCode)
	assert.JSONEq(t, `{
		"status": "Failure",
		"reason": "Timeout",
		"metadata": {},
		"message": "Timeout",
		"details": { "uid": "test.thisIsExpected" },
		"code": 504
	  }`, recorder.Body.String())
}

func TestWriteAPIStatus(t *testing.T) {
	want := metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusTooManyRequests,
		Reason:  metav1.StatusReasonTooManyRequests,
		Message: "search is busy",
		Details: &metav1.StatusDetails{
			Name:              "dashboard",
			Group:             "dashboard.grafana.app",
			Kind:              "dashboards",
			UID:               "uid",
			RetryAfterSeconds: 12,
		},
	}
	statusErr := &apierrors.StatusError{ErrStatus: want}
	tests := []struct {
		name string
		err  error
	}{
		{
			name: "direct",
			err:  statusErr,
		},
		{
			name: "wrapped",
			err:  fmt.Errorf("search: %w", statusErr),
		},
		{
			name: "multiply wrapped",
			err:  fmt.Errorf("handler: %w", fmt.Errorf("search: %w", statusErr)),
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()

			code := Write(context.Background(), tc.err, recorder)

			require.Equal(t, http.StatusTooManyRequests, code)
			require.Equal(t, code, recorder.Code)
			require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))

			var got metav1.Status
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &got))
			require.Equal(t, want, got)
		})
	}
}

func doError(t *testing.T, ctx context.Context) (*httptest.ResponseRecorder, int) {
	t.Helper()

	const msgID = "test.thisIsExpected"
	base := errutil.Timeout(msgID)
	var statusCode int
	handler := func(writer http.ResponseWriter, _ *http.Request) {
		statusCode = Write(ctx, base.Errorf("got expected error"), writer)
	}

	req := httptest.NewRequest("GET", "http://localhost:3000/fake", nil)
	recorder := httptest.NewRecorder()

	handler(recorder, req)
	return recorder, statusCode
}

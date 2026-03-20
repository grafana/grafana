package errhttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
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

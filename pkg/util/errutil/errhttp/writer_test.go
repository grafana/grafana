package errhttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/util/errutil"
)

func TestWrite(t *testing.T) {
	// Error without k8s context
	recorder := doError(t, context.Background())
	assert.Equal(t, http.StatusGatewayTimeout, recorder.Code)
	assert.JSONEq(t, `{"message": "Timeout", "messageId": "test.thisIsExpected", "statusCode": 504}`, recorder.Body.String())

	// Another request, but within the k8s framework
	recorder = doError(t, request.WithRequestInfo(context.Background(), &request.RequestInfo{
		APIGroup: "TestGroup",
	}))
	assert.Equal(t, http.StatusGatewayTimeout, recorder.Code)
	assert.JSONEq(t, `{
		"status": "Failure",
		"reason": "Timeout",
		"metadata": {},
		"messageId": "test.thisIsExpected",
		"message": "Timeout",
		"details": { "group": "TestGroup" },
		"code": 504
	  }`, recorder.Body.String())
}

func doError(t *testing.T, ctx context.Context) *httptest.ResponseRecorder {
	t.Helper()

	const msgID = "test.thisIsExpected"
	base := errutil.Timeout(msgID)
	handler := func(writer http.ResponseWriter, _ *http.Request) {
		Write(ctx, base.Errorf("got expected error"), writer)
	}

	req := httptest.NewRequest("GET", "http://localhost:3000/fake", nil)
	recorder := httptest.NewRecorder()

	handler(recorder, req)
	return recorder
}

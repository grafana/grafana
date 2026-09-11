package graphite

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseResponseRejectsOversizedRenderBody(t *testing.T) {
	svc := &Service{
		logger: log.NewNullLogger(),
		caps:   caps{renderResponseMaxBytes: 16},
	}
	res := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("x"), 100))),
		Header:     make(http.Header),
	}

	_, err := svc.parseResponse(res)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeded")
}

func TestParseResponseAcceptsBodyAtCap(t *testing.T) {
	payload := "[]"
	svc := &Service{
		logger: log.NewNullLogger(),
		caps:   caps{renderResponseMaxBytes: int64(len(payload))},
	}
	res := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(payload)),
		Header:     make(http.Header),
	}

	out, err := svc.parseResponse(res)
	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestDecodeRejectsOversizedResponse(t *testing.T) {
	body := io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("y"), 100)))

	_, err := decode("", body, 16)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "exceeded")
}

func TestDecodeAcceptsResponseAtCap(t *testing.T) {
	out, err := decode("", io.NopCloser(strings.NewReader("hello")), 5)
	require.NoError(t, err)
	assert.Equal(t, "hello", string(out))
}

func TestHandleResourceReqRejectsOversizedRequestBody(t *testing.T) {
	svc := &Service{
		logger: log.NewNullLogger(),
		im:     &mockInstanceManager{instance: datasourceInfo{Id: 1}},
		caps:   caps{resourceRequestMaxBytes: 16},
	}
	handlerReached := false
	handler := handleResourceReq(func(context.Context, *datasourceInfo, *map[string]any) ([]byte, int, error) {
		handlerReached = true
		return []byte("{}"), http.StatusOK, nil
	}, svc)

	req := httptest.NewRequest(http.MethodPost, "/metrics/find", bytes.NewReader(bytes.Repeat([]byte("z"), 100)))
	rw := httptest.NewRecorder()

	handler(rw, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, rw.Code)
	assert.False(t, handlerReached, "handler should not run when the request body is over the cap")
}

func TestHandleResourceReqAcceptsRequestBodyAtCap(t *testing.T) {
	body := `{"q":"x"}`
	svc := &Service{
		logger: log.NewNullLogger(),
		im:     &mockInstanceManager{instance: datasourceInfo{Id: 1}},
		caps:   caps{resourceRequestMaxBytes: int64(len(body))},
	}
	handler := handleResourceReq(func(context.Context, *datasourceInfo, *map[string]any) ([]byte, int, error) {
		return []byte(`{"ok":true}`), http.StatusOK, nil
	}, svc)

	req := httptest.NewRequest(http.MethodPost, "/metrics/find", strings.NewReader(body))
	rw := httptest.NewRecorder()

	handler(rw, req)

	assert.Equal(t, http.StatusOK, rw.Code)
}

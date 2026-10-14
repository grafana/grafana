package search

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
)

func TestHTTPHandler(t *testing.T) {
	call := func(handlerErr error) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		HTTPHandler(func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
			return handlerErr
		})(rec, httptest.NewRequest(http.MethodPost, "/", nil))
		return rec
	}

	t.Run("passes the namespace and body through", func(t *testing.T) {
		var got *app.CustomRouteRequest
		var body string
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"limit":1}`))
		r = r.WithContext(request.WithNamespace(r.Context(), "org-2"))
		HTTPHandler(func(_ context.Context, _ app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
			got = req
			b, err := io.ReadAll(req.Body)
			body = string(b)
			return err
		})(httptest.NewRecorder(), r)
		require.NotNil(t, got)
		assert.Equal(t, "org-2", got.ResourceIdentifier.Namespace)
		assert.Equal(t, http.MethodPost, got.Method)
		assert.Equal(t, `{"limit":1}`, body)
	})

	t.Run("writes a client error with its status", func(t *testing.T) {
		rec := call(apierrors.NewBadRequest("facets are not supported"))
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
		assert.Contains(t, rec.Body.String(), "facets are not supported")
		assert.Contains(t, rec.Body.String(), `"code":400`)
	})

	t.Run("unwraps a wrapped client error", func(t *testing.T) {
		rec := call(fmt.Errorf("context: %w", apierrors.NewNotFound(alertrule.ResourceInfo.GroupResource(), "x")))
		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("writes a server error as a 500", func(t *testing.T) {
		rec := call(apierrors.NewInternalError(errors.New("boom")))
		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	t.Run("writes a non-status error as a 500", func(t *testing.T) {
		rec := call(errors.New("plain"))
		assert.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	t.Run("leaves a successful response alone", func(t *testing.T) {
		rec := call(nil)
		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Empty(t, rec.Body.String())
	})
}

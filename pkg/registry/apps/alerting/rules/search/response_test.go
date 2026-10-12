package search

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
)

func TestWithAPIStatusErrorResponse(t *testing.T) {
	call := func(handlerErr error) (*httptest.ResponseRecorder, error) {
		rec := httptest.NewRecorder()
		err := WithAPIStatusErrorResponse(func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
			return handlerErr
		})(context.Background(), rec, &app.CustomRouteRequest{})
		return rec, err
	}

	// A 4xx has to be written here: the sdk turns any returned error into a 500.
	t.Run("writes a client error and stops returning it", func(t *testing.T) {
		rec, err := call(apierrors.NewBadRequest("facets are not supported"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
		assert.Contains(t, rec.Body.String(), "facets are not supported")
		assert.Contains(t, rec.Body.String(), `"code":400`)
	})

	// Wrapped, because the sdk's own check is a bare type assertion and would
	// miss this — the wrapper uses errors.As so it does not.
	t.Run("unwraps a wrapped client error", func(t *testing.T) {
		rec, err := call(fmt.Errorf("context: %w", apierrors.NewNotFound(alertrule.ResourceInfo.GroupResource(), "x")))
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	// A 5xx is a real fault, so leave it to the runner's logging.
	t.Run("returns a server error untouched", func(t *testing.T) {
		in := apierrors.NewInternalError(errors.New("boom"))
		rec, err := call(in)
		require.Equal(t, in, err)
		assert.Equal(t, http.StatusOK, rec.Code, "nothing should be written")
	})

	t.Run("returns a non-status error untouched", func(t *testing.T) {
		in := errors.New("plain")
		_, err := call(in)
		require.Equal(t, in, err)
	})

	t.Run("passes success through", func(t *testing.T) {
		_, err := call(nil)
		require.NoError(t, err)
	})
}

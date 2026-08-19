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

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Unified search can report totalHits as an upper bound, so the relation has to
// travel with the count instead of letting a client assume it is exact.
func TestTotalHitsRelation(t *testing.T) {
	assert.Equal(t, searchv0.TotalHitsEqual, totalHitsRelation(true))
	assert.Equal(t, searchv0.TotalHitsAtMost, totalHitsRelation(false))
}

// TestNextPageToken covers when a cursor is offered. An inexact total may need
// one extra empty page because unified storage can stop an authorized scan
// before exhausting all matches.
func TestNextPageToken(t *testing.T) {
	page := func(rows int) *resourcepb.ResourceSearchResponse {
		table := &resourcepb.ResourceTable{}
		for i := 0; i < rows; i++ {
			table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{})
		}
		return &resourcepb.ResourceSearchResponse{Results: table, TotalHitsExact: true}
	}
	withTotal := func(resp *resourcepb.ResourceSearchResponse, total int64) *resourcepb.ResourceSearchResponse {
		resp.TotalHits = total
		return resp
	}

	t.Run("offers a cursor when rules remain", func(t *testing.T) {
		assert.Equal(t, encodeCursor(10), nextPageToken(withTotal(page(10), 25), 0))
		assert.Equal(t, encodeCursor(20), nextPageToken(withTotal(page(10), 25), 10))
	})

	t.Run("offers none on the last page", func(t *testing.T) {
		assert.Empty(t, nextPageToken(withTotal(page(5), 25), 20))
		assert.Empty(t, nextPageToken(withTotal(page(10), 10), 0))
	})

	t.Run("offers none for an empty page", func(t *testing.T) {
		assert.Empty(t, nextPageToken(withTotal(page(0), 0), 0))
		// A page past the end reads as the end rather than looping forever.
		assert.Empty(t, nextPageToken(withTotal(page(0), 25), 40))
	})

	t.Run("continues after a non-empty page when the total is inexact", func(t *testing.T) {
		resp := withTotal(page(5), 5)
		resp.TotalHitsExact = false
		assert.Equal(t, encodeCursor(5), nextPageToken(resp, 0))
	})
}

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

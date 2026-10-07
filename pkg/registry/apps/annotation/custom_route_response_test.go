package annotation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestWithAPIStatusErrorResponse(t *testing.T) {
	request := &app.CustomRouteRequest{}

	t.Run("writes 4xx API status response", func(t *testing.T) {
		forbidden := apierrors.NewForbidden(annotationGR, "graphite", errors.New("denied"))
		handler := withAPIStatusErrorResponse(func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
			return fmt.Errorf("wrapped: %w", forbidden)
		})
		writer := &mockResponseWriter{header: make(http.Header), body: &bytes.Buffer{}}

		err := handler(t.Context(), writer, request)

		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, writer.code)
		assert.Equal(t, "application/json", writer.header.Get("Content-Type"))

		var status metav1.Status
		require.NoError(t, json.Unmarshal(writer.body.Bytes(), &status))
		assert.Equal(t, int32(http.StatusForbidden), status.Code)
		assert.Equal(t, metav1.StatusReasonForbidden, status.Reason)
	})

	t.Run("passes through non API status errors", func(t *testing.T) {
		boom := errors.New("boom")
		handler := withAPIStatusErrorResponse(func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
			return boom
		})
		writer := &mockResponseWriter{header: make(http.Header), body: &bytes.Buffer{}}

		err := handler(t.Context(), writer, request)

		require.ErrorIs(t, err, boom)
		assert.Zero(t, writer.code)
		assert.Empty(t, writer.body.String())
	})

	t.Run("passes through API status errors outside 4xx", func(t *testing.T) {
		internal := apierrors.NewInternalError(errors.New("database unavailable"))
		handler := withAPIStatusErrorResponse(func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
			return internal
		})
		writer := &mockResponseWriter{header: make(http.Header), body: &bytes.Buffer{}}

		err := handler(t.Context(), writer, request)

		require.ErrorIs(t, err, internal)
		assert.Zero(t, writer.code)
		assert.Empty(t, writer.body.String())
	})
}

package requestmeta

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStatusSource(t *testing.T) {
	ctx := context.Background()
	ctx = SetRequestMetaData(ctx, defaultRequestMetadata())
	rmd := GetRequestMetaData(ctx)
	require.Equal(t, StatusSourceServer, rmd.StatusSource)

	WithDownstreamStatusSource(ctx)
	rmd = GetRequestMetaData(ctx)
	require.Equal(t, StatusSourceDownstream, rmd.StatusSource)
}

func TestWithStatusSource(t *testing.T) {
	tcs := []struct {
		status         int
		expectedSource StatusSource
	}{
		{status: http.StatusOK, expectedSource: StatusSourceServer},
		{status: http.StatusBadRequest, expectedSource: StatusSourceServer},
		{status: http.StatusForbidden, expectedSource: StatusSourceServer},
		{status: http.StatusUnauthorized, expectedSource: StatusSourceServer},
		{status: http.StatusInternalServerError, expectedSource: StatusSourceDownstream},
		{status: http.StatusBadGateway, expectedSource: StatusSourceDownstream},
		{status: http.StatusGatewayTimeout, expectedSource: StatusSourceDownstream},
		{status: 599, expectedSource: StatusSourceDownstream},
	}

	for _, tc := range tcs {
		t.Run(fmt.Sprintf("status %d => source %s ", tc.status, tc.expectedSource), func(t *testing.T) {
			ctx := context.Background()
			ctx = SetRequestMetaData(ctx, defaultRequestMetadata())
			WithStatusSource(ctx, tc.status)
			rmd := GetRequestMetaData(ctx)
			require.Equal(t, tc.expectedSource, rmd.StatusSource)
		})
	}
}

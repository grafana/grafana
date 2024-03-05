package clientmiddleware

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestRequestStatus(t *testing.T) {
	tcs := []struct {
		s             requestStatus
		expectedLabel string
	}{
		{
			s:             requestStatusOK,
			expectedLabel: "ok",
		},
		{
			s:             requestStatusError,
			expectedLabel: "error",
		},
		{
			s:             requestStatusCancelled,
			expectedLabel: "cancelled",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.s.String(), func(t *testing.T) {
			require.Equal(t, tc.expectedLabel, tc.s.String())
			require.Equal(t, tc.expectedLabel, fmt.Sprint(tc.s))
		})
	}
}

func TestRequestStatusFromError(t *testing.T) {
	tcs := []struct {
		desc           string
		err            error
		expectedStatus requestStatus
	}{
		{
			desc:           "no error should be status ok",
			err:            nil,
			expectedStatus: requestStatusOK,
		},
		{
			desc:           "error should be status error",
			err:            errors.New("boom"),
			expectedStatus: requestStatusError,
		},
		{
			desc:           "context canceled should be status cancelled",
			err:            context.Canceled,
			expectedStatus: requestStatusCancelled,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			status := requestStatusFromError(tc.err)
			require.Equal(t, tc.expectedStatus, status)
		})
	}
}

func TestRequestStatusFromQueryDataResponse(t *testing.T) {
	responseWithoutError := backend.NewQueryDataResponse()
	responseWithoutError.Responses["A"] = backend.DataResponse{
		Frames: data.Frames{data.NewFrame("test")},
	}

	responseWithError := backend.NewQueryDataResponse()
	responseWithError.Responses["A"] = backend.DataResponse{
		Error: errors.New("boom"),
	}
	responseWithMultipleErrors := backend.NewQueryDataResponse()
	responseWithMultipleErrors.Responses["A"] = backend.DataResponse{
		Error: context.Canceled,
	}
	responseWithMultipleErrors.Responses["B"] = backend.DataResponse{
		Frames: data.Frames{data.NewFrame("test")},
	}
	responseWithMultipleErrors.Responses["C"] = backend.DataResponse{
		Error: errors.New("boom"),
	}

	tcs := []struct {
		desc           string
		resp           *backend.QueryDataResponse
		err            error
		expectedStatus requestStatus
	}{
		{
			desc:           "no error should be status ok",
			err:            nil,
			expectedStatus: requestStatusOK,
		},
		{
			desc:           "error should be status error",
			err:            errors.New("boom"),
			expectedStatus: requestStatusError,
		},
		{
			desc:           "context canceled should be status cancelled",
			err:            context.Canceled,
			expectedStatus: requestStatusCancelled,
		},
		{
			desc:           "response without error should be status ok",
			resp:           responseWithoutError,
			expectedStatus: requestStatusOK,
		},
		{
			desc:           "response with error should be status error",
			resp:           responseWithError,
			expectedStatus: requestStatusError,
		},
		{
			desc:           "response with multiple error should pick the highest status cancelled",
			resp:           responseWithMultipleErrors,
			expectedStatus: requestStatusError,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			status := requestStatusFromQueryDataResponse(tc.resp, tc.err)
			require.Equal(t, tc.expectedStatus, status)
		})
	}
}

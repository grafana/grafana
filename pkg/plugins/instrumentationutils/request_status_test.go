package instrumentationutils

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestRequestStatus(t *testing.T) {
	tcs := []struct {
		s             RequestStatus
		expectedLabel string
	}{
		{
			s:             RequestStatusOK,
			expectedLabel: "ok",
		},
		{
			s:             RequestStatusError,
			expectedLabel: "error",
		},
		{
			s:             RequestStatusCancelled,
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
		expectedStatus RequestStatus
	}{
		{
			desc:           "no error should be status ok",
			err:            nil,
			expectedStatus: RequestStatusOK,
		},
		{
			desc:           "error should be status error",
			err:            errors.New("boom"),
			expectedStatus: RequestStatusError,
		},
		{
			desc:           "context canceled should be status cancelled",
			err:            context.Canceled,
			expectedStatus: RequestStatusCancelled,
		},
		{
			desc:           "gRPC canceled should be status cancelled",
			err:            status.Error(codes.Canceled, "canceled"),
			expectedStatus: RequestStatusCancelled,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			status := RequestStatusFromError(tc.err)
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
		expectedStatus RequestStatus
	}{
		{
			desc:           "no error should be status ok",
			err:            nil,
			expectedStatus: RequestStatusOK,
		},
		{
			desc:           "error should be status error",
			err:            errors.New("boom"),
			expectedStatus: RequestStatusError,
		},
		{
			desc:           "context canceled should be status cancelled",
			err:            context.Canceled,
			expectedStatus: RequestStatusCancelled,
		},
		{
			desc:           "response without error should be status ok",
			resp:           responseWithoutError,
			expectedStatus: RequestStatusOK,
		},
		{
			desc:           "response with error should be status error",
			resp:           responseWithError,
			expectedStatus: RequestStatusError,
		},
		{
			desc:           "response with multiple error should pick the highest status cancelled",
			resp:           responseWithMultipleErrors,
			expectedStatus: RequestStatusError,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			status := RequestStatusFromQueryDataResponse(tc.resp, tc.err)
			require.Equal(t, tc.expectedStatus, status)
		})
	}
}

func TestRequestStatusFromErrorString(t *testing.T) {
	tcs := []struct {
		desc           string
		err            string
		expectedStatus RequestStatus
	}{
		{
			desc:           "no error should be status ok",
			err:            "",
			expectedStatus: RequestStatusOK,
		},
		{
			desc:           "error should be status error",
			err:            errors.New("boom").Error(),
			expectedStatus: RequestStatusError,
		},
		{
			desc:           "context canceled should be status cancelled",
			err:            context.Canceled.Error(),
			expectedStatus: RequestStatusCancelled,
		},
		{
			desc:           "gRPC canceled should be status cancelled",
			err:            status.Error(codes.Canceled, "canceled").Error(),
			expectedStatus: RequestStatusCancelled,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			status := RequestStatusFromErrorString(tc.err)
			require.Equal(t, tc.expectedStatus, status)
		})
	}
}

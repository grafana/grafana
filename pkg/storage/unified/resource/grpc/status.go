package grpc

import (
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// statusClientClosedRequest is the non-standard nginx status that
// runtime.HTTPStatusFromCode maps codes.Canceled onto.
const statusClientClosedRequest = 499

func ErrorResultWithGRPCStatus(message string, httpCode int32, grpcStatus codes.Code) (*resourcepb.ErrorResult, error) {
	return &resourcepb.ErrorResult{
		Message: message,
		Code:    httpCode,
	}, status.Error(grpcStatus, message)
}

// GRPCStatusFromErrorResult inverts runtime.HTTPStatusFromCode, which is what
// resource.AsErrorResult uses for the gRPC -> HTTP direction.
func GRPCStatusFromErrorResult(errorResult *resourcepb.ErrorResult) error {
	if errorResult == nil {
		return nil
	}

	return status.Error(grpcCodeFromHTTPStatus(errorResult.Code), errorResult.Message)
}

// grpcCodeFromHTTPStatus is lossy in a way runtime.HTTPStatusFromCode is not:
// several gRPC codes collapse onto the same HTTP status going out
// (AlreadyExists and Aborted both become 409, InvalidArgument /
// FailedPrecondition / OutOfRange all become 400), so coming back we pick the
// code that unified storage actually produces for that status.
func grpcCodeFromHTTPStatus(httpCode int32) codes.Code {
	switch httpCode {
	case http.StatusOK:
		return codes.OK
	case http.StatusBadRequest:
		return codes.InvalidArgument
	case http.StatusUnauthorized:
		return codes.Unauthenticated
	case http.StatusForbidden:
		return codes.PermissionDenied
	case http.StatusNotFound:
		return codes.NotFound
	case http.StatusRequestTimeout:
		return codes.DeadlineExceeded
	case http.StatusConflict:
		return codes.AlreadyExists
	case http.StatusPreconditionFailed:
		return codes.FailedPrecondition
	case http.StatusRequestedRangeNotSatisfiable:
		return codes.OutOfRange
	case http.StatusUnprocessableEntity:
		return codes.InvalidArgument
	case http.StatusTooManyRequests:
		return codes.ResourceExhausted
	case statusClientClosedRequest:
		return codes.Canceled
	case http.StatusInternalServerError:
		return codes.Internal
	case http.StatusNotImplemented:
		return codes.Unimplemented
	case http.StatusServiceUnavailable:
		return codes.Unavailable
	case http.StatusGatewayTimeout:
		return codes.DeadlineExceeded
	}

	switch {
	case httpCode >= 500:
		return codes.Internal
	case httpCode >= 400:
		return codes.InvalidArgument
	default:
		// An ErrorResult carrying a non-error status is a caller bug, not a
		// success: codes.OK here would silently turn it into a nil error.
		return codes.Unknown
	}
}

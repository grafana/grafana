package apierrors

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/web"
)

func TestStorageErrorResponseCompatibility(t *testing.T) {
	wrap := func(err error) error { return fmt.Errorf("search: %w", err) }
	operation := func(err error) error { return folder.ErrInternal.Errorf("failed to fetch dashboards: %w", err) }
	canceled := response.JSON(499, errutil.PublicError{StatusCode: 499, MessageID: "api.requestCanceled", Message: "Request canceled"})

	for name, convert := range map[string]func(error) response.Response{
		"Folder": ToFolderErrorResponse,
		"Dashboard": func(err error) response.Response {
			return ToDashboardErrorResponse(context.Background(), nil, err)
		},
	} {
		t.Run(name, func(t *testing.T) {
			for _, tc := range []struct {
				code int
				wrap func(error) error
			}{
				{404, func(err error) error { return err }},
				{409, wrap},
				{429, operation},
				{503, func(err error) error { return wrap(operation(err)) }},
			} {
				t.Run(fmt.Sprint(tc.code), func(t *testing.T) {
					result := &resourcepb.ErrorResult{
						Code: int32(tc.code), Message: "storage failure",
						Details: &resourcepb.ErrorDetails{RetryAfterSeconds: 12},
					}
					st, err := status.New(codes.Unknown, "transport message").WithDetails(result)
					require.NoError(t, err)
					for encoding, input := range map[string]error{"embedded": resource.StatusError(result), "grpc": st.Err()} {
						t.Run(encoding, func(t *testing.T) {
							assertLegacyHTTPResponse(t, convert, tc.wrap(input), response.Error(tc.code, "storage failure", nil))
						})
					}
				})
			}
			for _, tc := range []struct {
				name string
				err  error
				want response.Response
			}{
				{"unstructured grpc", status.Error(codes.Unavailable, "private details"), response.Error(503, "Service Unavailable", nil)},
				{"ordinary transport", errors.New("connection refused"), response.Error(500, name+" API error: connection refused", nil)},
				{"operation error", operation(errors.New("connection refused")), response.Err(operation(errors.New("connection refused")))},
				{"canceled", context.Canceled, canceled},
				{"wrapped canceled", wrap(context.Canceled), canceled},
				{"operation canceled", operation(context.Canceled), response.Err(operation(context.Canceled))},
				{"wrapped operation canceled", wrap(operation(context.Canceled)), response.Err(operation(context.Canceled))},
				{"deadline exceeded", context.DeadlineExceeded, response.Error(500, name+" API error: context deadline exceeded", nil)},
				{"wrapped deadline exceeded", wrap(context.DeadlineExceeded), response.Error(500, name+" API error: search: context deadline exceeded", nil)},
				{"operation deadline exceeded", operation(context.DeadlineExceeded), response.Err(operation(context.DeadlineExceeded))},
				{"wrapped operation deadline exceeded", wrap(operation(context.DeadlineExceeded)), response.Err(operation(context.DeadlineExceeded))},
				{"grpc deadline exceeded", status.Error(codes.DeadlineExceeded, "private details"), response.Error(504, "Gateway Timeout", nil)},
				{"wrapped grpc deadline exceeded", wrap(status.Error(codes.DeadlineExceeded, "private details")), response.Error(504, "Gateway Timeout", nil)},
			} {
				t.Run(tc.name, func(t *testing.T) {
					assertLegacyHTTPResponse(t, convert, tc.err, tc.want)
				})
			}
		})
	}
}

func assertLegacyHTTPResponse(t *testing.T, convert func(error) response.Response, input error, want response.Response) {
	t.Helper()
	// WriteTo may add traceID to the body when unified logging is disabled.
	for _, unifiedLogging := range []bool{false, true} {
		ctx := context.Background()
		if unifiedLogging {
			ctx = errutil.SetUnifiedLogging(ctx)
		}
		recorder := httptest.NewRecorder()
		convert(input).WriteTo(&contextmodel.ReqContext{
			Context: &web.Context{
				Req:  httptest.NewRequestWithContext(ctx, http.MethodGet, "/", nil),
				Resp: web.NewResponseWriter(http.MethodGet, recorder),
			},
			Logger: log.New("test"),
		})
		var expected, actual map[string]any
		require.NoError(t, json.Unmarshal(want.Body(), &expected))
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &actual))
		if !unifiedLogging {
			expected["traceID"] = ""
		}
		require.Equal(t, want.Status(), recorder.Code)
		require.Equal(t, expected, actual, "unified logging=%t", unifiedLogging)
	}
}

func TestFolderStorageAlreadyExistsResponse(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: http.StatusConflict, Reason: string(metav1.StatusReasonAlreadyExists)}
	st, err := status.New(codes.AlreadyExists, "exists").WithDetails(result)
	require.NoError(t, err)
	for _, input := range []error{resource.StatusError(result), st.Err(), fmt.Errorf("search: %w", st.Err())} {
		got := ToFolderErrorResponse(input)
		require.Equal(t, http.StatusPreconditionFailed, got.Status())
		require.JSONEq(t, fmt.Sprintf(`{"status":"version-mismatch","message":%q}`, folder.ErrVersionMismatch.Error()), string(got.Body()))
	}
}

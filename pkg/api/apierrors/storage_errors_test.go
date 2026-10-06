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

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/web"
)

func storageErrorConverters() map[string]func(error) response.Response {
	return map[string]func(error) response.Response{
		"Folder": ToFolderErrorResponse,
		"Dashboard": func(err error) response.Response {
			return ToDashboardErrorResponse(context.Background(), nil, err)
		},
	}
}

func expectedErrorResponse(code int, message string) func(error) response.Response {
	return func(err error) response.Response {
		return response.Error(code, message, err)
	}
}

func TestStorageErrorResponseCompatibility(t *testing.T) {
	wrap := func(err error) error { return fmt.Errorf("search: %w", err) }
	operation := func(err error) error { return folder.ErrInternal.Errorf("failed to fetch dashboards: %w", err) }
	rateLimited := status.Error(codes.ResourceExhausted, "rate limit exceeded")
	canceled := func(err error) response.Response {
		return response.Err(errutil.ClientClosedRequest("api.requestCanceled", errutil.WithPublicMessage("Request canceled")).Errorf("request canceled: %w", err))
	}
	operationError := func(err error) response.Response { return response.Err(err) }

	for name, convert := range storageErrorConverters() {
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
							assertLegacyHTTPResponse(t, convert, tc.wrap(input), expectedErrorResponse(tc.code, "storage failure"))
						})
					}
				})
			}
			for _, tc := range []struct {
				name string
				err  error
				want func(error) response.Response
			}{
				{"unstructured grpc", status.Error(codes.Unavailable, "private details"), expectedErrorResponse(503, "Service Unavailable")},
				{"grpc resource exhausted", rateLimited, expectedErrorResponse(429, rateLimited.Error())},
				{"wrapped grpc resource exhausted", wrap(rateLimited), expectedErrorResponse(429, rateLimited.Error())},
				{"operation grpc resource exhausted", operation(rateLimited), expectedErrorResponse(429, rateLimited.Error())},
				{"wrapped operation grpc resource exhausted", wrap(operation(rateLimited)), expectedErrorResponse(429, rateLimited.Error())},
				{"ordinary transport", errors.New("connection refused"), expectedErrorResponse(500, name+" API error: connection refused")},
				{"operation error", operation(errors.New("connection refused")), operationError},
				{"canceled", context.Canceled, canceled},
				{"wrapped canceled", wrap(context.Canceled), canceled},
				{"operation canceled", operation(context.Canceled), operationError},
				{"wrapped operation canceled", wrap(operation(context.Canceled)), operationError},
				{"deadline exceeded", context.DeadlineExceeded, expectedErrorResponse(500, name+" API error: context deadline exceeded")},
				{"wrapped deadline exceeded", wrap(context.DeadlineExceeded), expectedErrorResponse(500, name+" API error: search: context deadline exceeded")},
				{"operation deadline exceeded", operation(context.DeadlineExceeded), operationError},
				{"wrapped operation deadline exceeded", wrap(operation(context.DeadlineExceeded)), operationError},
				{"grpc deadline exceeded", status.Error(codes.DeadlineExceeded, "private details"), expectedErrorResponse(504, "Gateway Timeout")},
				{"wrapped grpc deadline exceeded", wrap(status.Error(codes.DeadlineExceeded, "private details")), expectedErrorResponse(504, "Gateway Timeout")},
			} {
				t.Run(tc.name, func(t *testing.T) {
					assertLegacyHTTPResponse(t, convert, tc.err, tc.want)
				})
			}
		})
	}
}

func TestStorageErrorResponsePreservesOriginalErrorForLogging(t *testing.T) {
	original := folder.ErrInternal.Errorf("private operation details: %w", status.Error(codes.ResourceExhausted, "rate limit exceeded"))
	for name, convert := range storageErrorConverters() {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx := &contextmodel.ReqContext{
				Context: &web.Context{
					Req:  httptest.NewRequestWithContext(errutil.SetUnifiedLogging(context.Background()), http.MethodGet, "/", nil),
					Resp: web.NewResponseWriter(http.MethodGet, recorder),
				},
				Logger: log.New("test"),
			}
			convert(original).WriteTo(ctx)
			require.Equal(t, http.StatusTooManyRequests, recorder.Code)
			require.NotContains(t, recorder.Body.String(), "private operation details")
			require.Equal(t, original, ctx.Error)
		})
	}
}

func assertLegacyHTTPResponse(t *testing.T, convert func(error) response.Response, input error, want func(error) response.Response) {
	t.Helper()
	// WriteTo may add traceID to the body when unified logging is disabled.
	for _, unifiedLogging := range []bool{false, true} {
		ctx := context.Background()
		if unifiedLogging {
			ctx = errutil.SetUnifiedLogging(ctx)
		}
		render := func(resp response.Response) *httptest.ResponseRecorder {
			recorder := httptest.NewRecorder()
			resp.WriteTo(&contextmodel.ReqContext{
				Context: &web.Context{
					Req:  httptest.NewRequestWithContext(ctx, http.MethodGet, "/", nil),
					Resp: web.NewResponseWriter(http.MethodGet, recorder),
				},
				Logger: log.New("test"),
			})
			return recorder
		}
		expectedResponse, actualResponse := render(want(input)), render(convert(input))
		var expected, actual map[string]any
		require.NoError(t, json.Unmarshal(expectedResponse.Body.Bytes(), &expected))
		require.NoError(t, json.Unmarshal(actualResponse.Body.Bytes(), &actual))
		require.Equal(t, expectedResponse.Code, actualResponse.Code)
		require.Equal(t, expected, actual, "unified logging=%t", unifiedLogging)
	}
}

func TestFolderStorageAlreadyExistsResponse(t *testing.T) {
	result := &resourcepb.ErrorResult{Code: http.StatusConflict, Reason: string(metav1.StatusReasonAlreadyExists)}
	st, err := status.New(codes.AlreadyExists, "exists").WithDetails(result)
	require.NoError(t, err)
	for _, input := range []error{resource.StatusError(result), st.Err()} {
		for _, wrapped := range []error{input, fmt.Errorf("search: %w", input), folder.ErrInternal.Errorf("operation failed: %w", input)} {
			assertLegacyHTTPResponse(t, ToFolderErrorResponse, wrapped, func(error) response.Response {
				return response.JSON(http.StatusPreconditionFailed, map[string]any{
					"status": "version-mismatch", "message": folder.ErrVersionMismatch.Error(),
				})
			})
		}
	}
}

func TestDashboardStorageStatusMappings(t *testing.T) {
	convert := storageErrorConverters()["Dashboard"]
	for _, tc := range []struct {
		name   string
		result *resourcepb.ErrorResult
		want   func(error) response.Response
	}{
		{
			name: "folder not found",
			result: &resourcepb.ErrorResult{
				Code: http.StatusNotFound, Reason: string(metav1.StatusReasonNotFound), Message: "missing folder",
				Details: &resourcepb.ErrorDetails{Group: folderv1.APIGroup, Kind: folderv1.RESOURCE},
			},
			want: func(error) response.Response {
				return response.Error(http.StatusBadRequest, dashboards.ErrFolderNotFound.Error(), nil)
			},
		},
		{
			name: "payload too large",
			result: &resourcepb.ErrorResult{
				Code: http.StatusRequestEntityTooLarge, Reason: string(metav1.StatusReasonRequestEntityTooLarge), Message: "storage failure",
			},
			want: expectedErrorResponse(http.StatusRequestEntityTooLarge, fmt.Sprintf("Dashboard is too large, max is %d MB", apiserver.MaxRequestBodyBytes/1024/1024)),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			st, err := status.New(codes.Unknown, "transport message").WithDetails(tc.result)
			require.NoError(t, err)
			for encoding, input := range map[string]error{"embedded": resource.StatusError(tc.result), "grpc": st.Err()} {
				t.Run(encoding, func(t *testing.T) {
					for name, wrapped := range map[string]error{
						"bare":              input,
						"wrapped":           fmt.Errorf("search: %w", input),
						"operation":         folder.ErrInternal.Errorf("operation failed: %w", input),
						"wrapped operation": fmt.Errorf("search: %w", folder.ErrInternal.Errorf("operation failed: %w", input)),
					} {
						t.Run(name, func(t *testing.T) {
							assertLegacyHTTPResponse(t, convert, wrapped, tc.want)
						})
					}
				})
			}
		})
	}
}

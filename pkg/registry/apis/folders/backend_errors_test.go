package folders

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	otelcodes "go.opentelemetry.io/otel/codes"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/client-go/kubernetes/scheme"

	authlib "github.com/grafana/authlib/types"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const backendDiagnostic = "PRIVATE_BACKEND_DIAGNOSTIC"

func requireSanitizedBackendResponse(t *testing.T, err error, code int, retry string) {
	t.Helper()
	require.Error(t, err)
	w := httptest.NewRecorder()
	responsewriters.ErrorNegotiated(err, scheme.Codecs, schema.GroupVersion{Version: "v1"}, w, httptest.NewRequest(http.MethodPost, "/folders", nil))
	require.Equal(t, code, w.Code)
	require.Equal(t, retry, w.Header().Get("Retry-After"))
	require.NotContains(t, w.Body.String(), backendDiagnostic)
	if code == http.StatusForbidden {
		var public metav1.Status
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &public))
		require.Equal(t, "Access denied", public.Message)
		require.Equal(t, metav1.StatusReasonForbidden, public.Reason)
	}
}

func TestCreateSanitizesBackendServerErrors(t *testing.T) {
	detailed := &apierrors.StatusError{ErrStatus: metav1.Status{
		Code: 503, Reason: metav1.StatusReasonServiceUnavailable, Message: backendDiagnostic,
		Details: &metav1.StatusDetails{Name: backendDiagnostic, Group: backendDiagnostic, Kind: backendDiagnostic, UID: backendDiagnostic, RetryAfterSeconds: 7,
			Causes: []metav1.StatusCause{{Field: backendDiagnostic, Message: backendDiagnostic}}},
	}}
	for _, tc := range []struct {
		name  string
		err   error
		code  int
		retry string
	}{
		{"internal", apierrors.NewInternalError(errors.New(backendDiagnostic)), 500, ""},
		{"detailed unavailable", detailed, 503, "7"},
		{"transport", status.Error(codes.Unavailable, backendDiagnostic), 503, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			fs := folderStorage{store: store}
			_, err := fs.Create(context.Background(), ancestryTestFolder("child", ""), nil, &metav1.CreateOptions{})
			requireSanitizedBackendResponse(t, err, tc.code, tc.retry)
		})
	}
	require.Equal(t, backendDiagnostic, detailed.ErrStatus.Message)
	require.Equal(t, backendDiagnostic, detailed.ErrStatus.Details.Name)
}

func TestBackendServerTimeoutRetainsRetryClassification(t *testing.T) {
	for _, wrapped := range []bool{false, true} {
		for _, boundary := range []string{"create", "move"} {
			t.Run(fmt.Sprintf("%s/wrapped=%t", boundary, wrapped), func(t *testing.T) {
				var original error = apierrors.NewServerTimeout(schema.GroupResource{Group: backendDiagnostic, Resource: backendDiagnostic}, backendDiagnostic, 7)
				if wrapped {
					original = fmt.Errorf("%s: %w", backendDiagnostic, original)
				}
				store := grafanarest.NewMockStorage(t)
				var err error
				if boundary == "create" {
					store.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, original).Once()
					fs := folderStorage{store: store}
					_, err = fs.Create(context.Background(), ancestryTestFolder("child", ""), nil, &metav1.CreateOptions{})
				} else {
					store.On("Get", mock.Anything, "new-parent", mock.Anything).Return(nil, original).Once()
					b := &FolderAPIBuilder{storage: store, parents: newParentsGetter(store), maxNestedFolderDepth: 5}
					old := ancestryTestFolder("child", "")
					obj := ancestryTestFolder("child", "new-parent")
					err = b.Validate(ancestryTestContext(t, "org-42", false), admission.NewAttributesRecord(
						obj, old, folderv1.SchemeGroupVersion.WithKind("Folder"), "org-42", obj.Name,
						folderv1.SchemeGroupVersion.WithResource("folders"), "", admission.Update, nil, false, nil,
					), nil)
				}
				requireSanitizedBackendResponse(t, err, 500, "7")
				require.True(t, apierrors.IsServerTimeout(err), "provisioning must recognize the error as retryable")
				require.Equal(t, metav1.StatusReasonServerTimeout, responsewriters.ErrorToAPIStatus(err).Reason)
			})
		}
	}
}

func TestCreationLookupServerMessagesRemainCompatible(t *testing.T) {
	for _, tc := range []struct {
		code    int
		message string
	}{
		{500, "an error on the server (\"\") has prevented the request from succeeding"},
		{503, "the server is currently unable to handle the request"},
		{504, "the server was unable to return a response in the time allotted, but may still be processing the request"},
	} {
		for _, wrapped := range []bool{false, true} {
			t.Run(fmt.Sprintf("%d/wrapped=%t", tc.code, wrapped), func(t *testing.T) {
				store := grafanarest.NewMockStorage(t)
				store.On("Get", mock.Anything, "C", mock.Anything).Return(nil, &apierrors.StatusError{ErrStatus: metav1.Status{Code: int32(tc.code), Message: backendDiagnostic}}).Once()
				err := validateAncestryTestCreateThroughStorage(ancestryTestContext(t, "org-42", false), store, 5, false, ancestryTestStorageWrapper(t, wrapped))
				require.Error(t, err)
				require.Equal(t, tc.message, responsewriters.ErrorToAPIStatus(err).Message)
			})
		}
	}
}

func TestBackendStatusReasonAllowlist(t *testing.T) {
	for _, reason := range []metav1.StatusReason{metav1.StatusReasonServerTimeout, metav1.StatusReasonTimeout, metav1.StatusReasonTooManyRequests, metav1.StatusReasonServiceUnavailable, metav1.StatusReasonExpired} {
		t.Run(string(reason), func(t *testing.T) {
			original := &apierrors.StatusError{ErrStatus: metav1.Status{Code: 500, Reason: reason, Message: backendDiagnostic}}
			public := backendStatusError(original)
			require.Equal(t, reason, public.ErrStatus.Reason)
			requireSanitizedBackendResponse(t, &public, 500, "")
		})
	}
	t.Run("unknown reason is not public", func(t *testing.T) {
		original := &apierrors.StatusError{ErrStatus: metav1.Status{Code: 500, Reason: metav1.StatusReason(backendDiagnostic), Message: backendDiagnostic}}
		public := backendStatusError(original)
		require.Equal(t, metav1.StatusReasonInternalError, public.ErrStatus.Reason)
		requireSanitizedBackendResponse(t, &public, 500, "")
	})
}

func TestMoveTargetAdmissionHidesBackendDiagnostics(t *testing.T) {
	store := grafanarest.NewMockStorage(t)
	store.On("Get", mock.Anything, "new-parent", mock.Anything).Return(nil, apierrors.NewServiceUnavailable(backendDiagnostic)).Once()
	b := &FolderAPIBuilder{storage: store, parents: newParentsGetter(store), maxNestedFolderDepth: 5}
	old := ancestryTestFolder("child", "")
	old.Namespace = "org-42"
	obj := ancestryTestFolder("child", "new-parent")
	obj.Namespace = old.Namespace
	err := b.Validate(ancestryTestContext(t, "org-42", false), admission.NewAttributesRecord(
		obj, old, folderv1.SchemeGroupVersion.WithKind("Folder"), obj.Namespace, obj.Name,
		folderv1.SchemeGroupVersion.WithResource("folders"), "", admission.Update, nil, false, nil,
	), nil)
	requireSanitizedBackendResponse(t, err, 503, "")
}

type capturingFolderLogger struct {
	logtest.Fake
}

func (l *capturingFolderLogger) FromContext(context.Context) log.Logger {
	return l
}

func captureFolderLogs(t *testing.T) *capturingFolderLogger {
	t.Helper()
	logger := &capturingFolderLogger{}
	previous := backendLogger
	backendLogger = logger
	t.Cleanup(func() { backendLogger = previous })
	return logger
}

func TestBackendFailureRetainsDiagnosticsInLogs(t *testing.T) {
	logger := captureFolderLogs(t)
	original := apierrors.NewServiceUnavailable(backendDiagnostic)
	err := sanitizedBackendError(context.Background(), "moveTargetLookup", original)
	requireSanitizedBackendResponse(t, err, 503, "")
	require.Equal(t, 1, logger.ErrorLogs.Calls)
	require.Equal(t, []any{"operation", "moveTargetLookup", "error", original}, logger.ErrorLogs.Ctx)
}

func TestParentFailuresAreLogged(t *testing.T) {
	for _, forCreate := range []bool{false, true} {
		for _, tc := range []struct {
			name       string
			obj        runtime.Object
			err        error
			level      string
			diagnostic string
		}{
			{name: "backend failure", err: errors.New(backendDiagnostic), level: "WARN", diagnostic: backendDiagnostic},
			{name: "missing parent", err: apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, "parent"), level: "DEBUG"},
			{name: "forbidden parent", err: apierrors.NewForbidden(schema.GroupResource{Resource: "folders"}, "parent", errors.New(backendDiagnostic)), level: "DEBUG"},
			{name: "grpc missing parent", err: status.Error(codes.NotFound, backendDiagnostic), level: "DEBUG"},
			{name: "wrong object type", obj: &unstructured.Unstructured{}, level: "ERROR", diagnostic: "expected folder, found: *unstructured.Unstructured"},
		} {
			t.Run(fmt.Sprintf("%s/create=%t", tc.name, forCreate), func(t *testing.T) {
				logger := captureFolderLogs(t)
				ctx := context.Background()
				store := grafanarest.NewMockStorage(t)
				store.On("Get", mock.Anything, "parent", mock.Anything).Return(tc.obj, tc.err).Once()
				_, _ = newParentsGetterWithPolicy(store, forCreate)(ctx, ancestryTestFolder("child", "parent"))
				level := tc.level
				if forCreate && level == "WARN" {
					level = "ERROR"
				}
				records := map[string]logtest.Logs{"DEBUG": logger.DebugLogs, "WARN": logger.WarnLogs, "ERROR": logger.ErrorLogs}
				require.Equal(t, 1, records[level].Calls)
				require.Equal(t, 1, logger.DebugLogs.Calls+logger.WarnLogs.Calls+logger.ErrorLogs.Calls)
				record := make(map[string]any)
				fields := records[level].Ctx
				for i := 0; i < len(fields); i += 2 {
					record[fields[i].(string)] = fields[i+1]
				}
				require.Equal(t, "parentLookup", record["operation"])
				require.Equal(t, "parent", record["parent"])
				require.Equal(t, "child", record["folder"])
				if tc.err != nil {
					require.Equal(t, tc.err, record["error"])
				} else {
					require.EqualError(t, record["error"].(error), tc.diagnostic)
				}
			})
		}
	}
}

func TestExpectedParentFailuresDoNotMarkTraceAsFailed(t *testing.T) {
	for _, lookupErr := range []error{
		apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, "parent"),
		apierrors.NewForbidden(schema.GroupResource{Resource: "folders"}, "parent", errors.New("denied")),
	} {
		t.Run(lookupErr.Error(), func(t *testing.T) {
			ctx, recorder, _ := newFolderTrace(t)
			store := grafanarest.NewMockStorage(t)
			store.On("Get", mock.Anything, "parent", mock.Anything).Return(nil, lookupErr).Once()
			info, err := newParentsGetter(store)(ctx, ancestryTestFolder("child", "parent"))
			require.NoError(t, err)
			require.True(t, info.Items[0].Detached)
			span := folderSpan(t, recorder, "folders.getParents")
			require.Equal(t, otelcodes.Unset, span.Status().Code)
			require.Empty(t, span.Events())
		})
	}
}

func TestDetachedParentHidesBackendDiagnostics(t *testing.T) {
	store := grafanarest.NewMockStorage(t)
	store.On("Get", mock.Anything, "parent", mock.Anything).Return(nil, errors.New(backendDiagnostic)).Once()
	info, err := newParentsGetter(store)(context.Background(), ancestryTestFolder("child", "parent"))
	require.NoError(t, err)
	require.Len(t, info.Items, 2)
	require.Equal(t, "parent", info.Items[0].Name)
	require.True(t, info.Items[0].Detached)
	body, err := json.Marshal(info)
	require.NoError(t, err)
	require.NotContains(t, string(body), backendDiagnostic)
}

func TestMalformedSubtreeSearchHidesDiagnostics(t *testing.T) {
	logger := captureFolderLogs(t)
	search := &capturingSearchClient{resp: &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields:       []*resourcepb.ResourceSearchField{{Name: backendDiagnostic, Type: resourcepb.ResourceSearchField_STRING}},
		Rows: []*resourcepb.ResourceSearchRow{{
			Key:    &resourcepb.ResourceKey{Name: "child"},
			Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 0, StringValues: []string{"one", "two"}}},
		}},
	}}
	err := checkSubtreeDepth(context.Background(), search, "org-42", "child", 2, 5)
	requireSanitizedBackendResponse(t, err, 500, "")
	require.Equal(t, 1, logger.ErrorLogs.Calls)
	require.Equal(t, "subtreeSearchDecode", logger.ErrorLogs.Ctx[1])
	require.Contains(t, logger.ErrorLogs.Ctx[3].(error).Error(), backendDiagnostic)
}

func TestBackendLoggerPreservesContext(t *testing.T) {
	var output bytes.Buffer
	logger := log.New("folders.context-test")
	logger.Swap(gokitlog.With(gokitlog.NewJSONLogger(&output), "logger", "folders.context-test"))
	previous := backendLogger
	backendLogger = logger
	t.Cleanup(func() { backendLogger = previous })
	ctx := log.WithContextualAttributes(context.Background(), []any{"requestId", "test-request"})
	err := sanitizedBackendError(ctx, "moveTargetLookup", apierrors.NewServiceUnavailable(backendDiagnostic))
	requireSanitizedBackendResponse(t, err, 503, "")
	var record map[string]any
	require.NoError(t, json.Unmarshal(output.Bytes(), &record))
	require.Equal(t, "test-request", record["requestId"])
	require.Equal(t, "folders.context-test", record["logger"])
	require.Equal(t, "moveTargetLookup", record["operation"])
	require.Equal(t, backendDiagnostic, record["error"])
}

func TestBackendForbiddenHasSafeMessage(t *testing.T) {
	for _, original := range []error{
		apierrors.NewForbidden(schema.GroupResource{Resource: backendDiagnostic}, backendDiagnostic, errors.New(backendDiagnostic)),
		status.Error(codes.PermissionDenied, backendDiagnostic),
		fmt.Errorf("%s: %w", backendDiagnostic, status.Error(codes.PermissionDenied, backendDiagnostic)),
	} {
		t.Run(fmt.Sprintf("%T", original), func(t *testing.T) {
			public := backendStatusError(original)
			requireSanitizedBackendResponse(t, &public, 403, "")
		})
	}
}

func TestSubtreeSearchHidesBackendDiagnostics(t *testing.T) {
	for _, tc := range []struct {
		name  string
		resp  *resourcepb.ResourceSearchResponse
		err   error
		code  int
		retry string
	}{
		{name: "embedded", resp: &resourcepb.ResourceSearchResponse{Error: &resourcepb.ErrorResult{Code: 503, Message: backendDiagnostic, Details: &resourcepb.ErrorDetails{Name: backendDiagnostic, RetryAfterSeconds: 7}}}, code: 503, retry: "7"},
		{name: "transport", err: status.Error(codes.PermissionDenied, backendDiagnostic), code: 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			search := &capturingSearchClient{resp: tc.resp, err: tc.err}
			err := checkSubtreeDepth(context.Background(), search, "org-42", "child", 2, 5)
			requireSanitizedBackendResponse(t, err, tc.code, tc.retry)
		})
	}
}

type failingMoveAccessClient struct {
	authlib.AccessClient
	result string
}

func (c *failingMoveAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	failure := apierrors.NewTooManyRequests(backendDiagnostic, 7)
	if c.result == "" {
		return authlib.BatchCheckResponse{}, failure
	}
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		result := authlib.BatchCheckResult{Allowed: true}
		if check.CorrelationID == c.result {
			result.Error = failure
		}
		results[check.CorrelationID] = result
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func TestMoveAccessHidesBackendDiagnostics(t *testing.T) {
	for _, result := range []string{"", "writeDest", "newFolder-get", "oldFolder-get"} {
		t.Run("result="+result, func(t *testing.T) {
			err := checkMoveAccess(ancestryTestContext(t, "org-42", false), "org-42", "child", "old", "new", &failingMoveAccessClient{result: result})
			requireSanitizedBackendResponse(t, err, 429, "7")
		})
	}
}

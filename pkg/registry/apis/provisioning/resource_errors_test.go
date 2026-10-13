package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/kubernetes/scheme"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestListConnector_StorageErrors(t *testing.T) {
	for _, tc := range provisioningHTTPErrors(t) {
		t.Run(tc.name, func(t *testing.T) {
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().List(mock.Anything, "default", "repo").Return(nil, tc.err).Once()
			responder := &testResponder{}
			ctx := request.WithNamespace(context.Background(), "default")
			handler, err := NewListConnector(nil, lister).Connect(ctx, "repo", nil, responder)
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
			req.Header.Set("Accept", "application/json")
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			require.Error(t, responder.err)
			responsewriters.ErrorNegotiated(responder.err, scheme.Codecs, schema.GroupVersion{Version: "v1"}, w, req)
			tc.assertResponse(t, w)
		})
	}
}

func TestHandleStats_StorageErrors(t *testing.T) {
	for _, tc := range provisioningHTTPErrors(t) {
		t.Run(tc.name, func(t *testing.T) {
			lister := resources.NewMockResourceLister(t)
			lister.EXPECT().Stats(mock.Anything, "default", "").Return(nil, tc.err).Once()
			b := &APIBuilder{resourceLister: lister}
			ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{Namespace: "default"})
			w := httptest.NewRecorder()
			b.handleStats(w, httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))
			tc.assertResponse(t, w)
		})
	}
}

type provisioningHTTPError struct {
	name string
	err  error
	want metav1.Status
}

func provisioningHTTPErrors(t *testing.T) []provisioningHTTPError {
	t.Helper()
	result := &resourcepb.ErrorResult{
		Code: http.StatusServiceUnavailable, Reason: string(metav1.StatusReasonServiceUnavailable), Message: "storage busy",
		Details: &resourcepb.ErrorDetails{RetryAfterSeconds: 5, Name: "repo"},
	}
	st, err := status.New(codes.Internal, "outer error").WithDetails(result)
	require.NoError(t, err)
	want := metav1.Status{
		Status: metav1.StatusFailure, Code: http.StatusServiceUnavailable,
		Reason: metav1.StatusReasonServiceUnavailable, Message: "storage busy",
		Details: &metav1.StatusDetails{RetryAfterSeconds: 5, Name: "repo"},
	}
	return []provisioningHTTPError{
		{name: "grpc details", err: st.Err(), want: want},
		{name: "unstructured grpc", err: status.Error(codes.Unavailable, "private backend diagnostic"), want: metav1.Status{
			Status: metav1.StatusFailure, Code: http.StatusServiceUnavailable, Message: "Service Unavailable",
		}},
	}
}

func (tc provisioningHTTPError) assertResponse(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	require.Equal(t, int(tc.want.Code), w.Code)
	var got metav1.Status
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	got.TypeMeta = metav1.TypeMeta{}
	require.Equal(t, tc.want, got)
}

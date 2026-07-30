package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8testing "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1/fake"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// mockOAuthCapableConnection combines the generated Connection and
// OAuthConnection mocks so the built connection passes the OAuth assertion.
type mockOAuthCapableConnection struct {
	*connection.MockConnection
	*connection.MockOAuthConnection
}

func TestConnectionAuthorizeConnector(t *testing.T) {
	connector := NewConnectionAuthorizeConnector(NewMockConnectionAuthorizeAccess(t))

	t.Run("New returns ConnectionAuthorizeRequest", func(t *testing.T) {
		obj := connector.New()
		require.IsType(t, &provisioning.ConnectionAuthorizeRequest{}, obj)
	})

	t.Run("ProducesMIMETypes returns application/json", func(t *testing.T) {
		types := connector.ProducesMIMETypes("POST")
		require.Equal(t, []string{"application/json"}, types)
	})

	t.Run("ProducesObject returns ConnectionAuthorizeRequest", func(t *testing.T) {
		obj := connector.ProducesObject("POST")
		require.IsType(t, &provisioning.ConnectionAuthorizeRequest{}, obj)
	})

	t.Run("ConnectMethods returns POST", func(t *testing.T) {
		methods := connector.ConnectMethods()
		require.Equal(t, []string{http.MethodPost}, methods)
	})

	t.Run("NewConnectOptions returns no path component", func(t *testing.T) {
		obj, hasPath, path := connector.NewConnectOptions()
		require.Nil(t, obj)
		require.False(t, hasPath)
		require.Empty(t, path)
	})

	t.Run("rejects non-POST methods", func(t *testing.T) {
		responder := &mockResponder{}
		handler := newAuthorizeHandler(t, NewMockConnectionAuthorizeAccess(t), responder)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)

		require.True(t, responder.called)
		require.True(t, apierrors.IsMethodNotSupported(responder.err))
	})

	t.Run("rejects non-JSON content type", func(t *testing.T) {
		responder := &mockResponder{}
		handler := newAuthorizeHandler(t, NewMockConnectionAuthorizeAccess(t), responder)

		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"spec":{"code":"abc"}}`))
		req.Header.Set("Content-Type", "text/plain")
		handler.ServeHTTP(httptest.NewRecorder(), req)

		require.True(t, responder.called)
		require.True(t, apierrors.IsBadRequest(responder.err))
	})

	t.Run("rejects unknown fields", func(t *testing.T) {
		responder := &mockResponder{}
		handler := newAuthorizeHandler(t, NewMockConnectionAuthorizeAccess(t), responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{"code":"abc","bogus":true}}`))

		require.True(t, responder.called)
		require.True(t, apierrors.IsBadRequest(responder.err))
	})

	t.Run("rejects missing code", func(t *testing.T) {
		responder := &mockResponder{}
		handler := newAuthorizeHandler(t, NewMockConnectionAuthorizeAccess(t), responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{}}`))

		require.True(t, responder.called)
		require.True(t, apierrors.IsBadRequest(responder.err))
	})

	t.Run("returns error when connection not found", func(t *testing.T) {
		responder := &mockResponder{}
		access := NewMockConnectionAuthorizeAccess(t)
		access.EXPECT().GetConnectionSpec(mock.Anything, "test-connection").
			Return(nil, apierrors.NewNotFound(provisioning.ConnectionResourceInfo.GroupResource(), "test-connection"))
		handler := newAuthorizeHandler(t, access, responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{"code":"abc"}}`))

		require.True(t, responder.called)
		require.True(t, apierrors.IsNotFound(responder.err))
	})

	t.Run("returns NotImplemented for non-OAuth connection", func(t *testing.T) {
		responder := &mockResponder{}
		access := NewMockConnectionAuthorizeAccess(t)
		access.EXPECT().GetConnectionSpec(mock.Anything, "test-connection").Return(testAuthorizeConnection(), nil)
		access.EXPECT().GetConnection(mock.Anything, "test-connection").Return(connection.NewMockConnection(t), nil)
		handler := newAuthorizeHandler(t, access, responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{"code":"abc"}}`))

		require.True(t, responder.called)
		var statusErr *apierrors.StatusError
		require.True(t, errors.As(responder.err, &statusErr))
		require.Equal(t, http.StatusNotImplemented, int(statusErr.ErrStatus.Code))
	})

	t.Run("returns error when code exchange fails", func(t *testing.T) {
		responder := &mockResponder{}
		oauthConn := &mockOAuthCapableConnection{
			MockConnection:      connection.NewMockConnection(t),
			MockOAuthConnection: connection.NewMockOAuthConnection(t),
		}
		oauthConn.MockOAuthConnection.EXPECT().
			ExchangeAuthorizationCode(mock.Anything, "abc", "").
			Return("", errors.New("provider rejected the code"))
		access := NewMockConnectionAuthorizeAccess(t)
		access.EXPECT().GetConnectionSpec(mock.Anything, "test-connection").Return(testAuthorizeConnection(), nil)
		access.EXPECT().GetConnection(mock.Anything, "test-connection").Return(oauthConn, nil)
		handler := newAuthorizeHandler(t, access, responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{"code":"abc"}}`))

		require.True(t, responder.called)
		require.True(t, apierrors.IsBadRequest(responder.err))
	})

	t.Run("returns error when storing the token fails", func(t *testing.T) {
		responder := &mockResponder{}
		fakeClient := &fake.FakeProvisioningV0alpha1{Fake: &k8testing.Fake{}}
		fakeClient.PrependReactor("patch", "connections", func(action k8testing.Action) (bool, runtime.Object, error) {
			return true, nil, errors.New("storage unavailable")
		})
		oauthConn := &mockOAuthCapableConnection{
			MockConnection:      connection.NewMockConnection(t),
			MockOAuthConnection: connection.NewMockOAuthConnection(t),
		}
		oauthConn.MockOAuthConnection.EXPECT().
			ExchangeAuthorizationCode(mock.Anything, "abc", "").
			Return(common.RawSecureValue("new-token"), nil)
		access := NewMockConnectionAuthorizeAccess(t)
		access.EXPECT().GetConnectionSpec(mock.Anything, "test-connection").Return(testAuthorizeConnection(), nil)
		access.EXPECT().GetConnection(mock.Anything, "test-connection").Return(oauthConn, nil)
		access.EXPECT().GetClient().Return(fakeClient)
		handler := newAuthorizeHandler(t, access, responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{"code":"abc"}}`))

		require.True(t, responder.called)
		require.True(t, apierrors.IsInternalError(responder.err))
	})

	t.Run("exchanges the code and clears it from the response", func(t *testing.T) {
		responder := &mockResponder{}
		fakeClient := &fake.FakeProvisioningV0alpha1{Fake: &k8testing.Fake{}}
		fakeClient.PrependReactor("patch", "connections", func(action k8testing.Action) (bool, runtime.Object, error) {
			return true, &provisioning.Connection{}, nil
		})
		oauthConn := &mockOAuthCapableConnection{
			MockConnection:      connection.NewMockConnection(t),
			MockOAuthConnection: connection.NewMockOAuthConnection(t),
		}
		oauthConn.MockOAuthConnection.EXPECT().
			ExchangeAuthorizationCode(mock.Anything, "abc", "https://grafana.example.com/callback").
			Return(common.RawSecureValue("new-token"), nil)
		access := NewMockConnectionAuthorizeAccess(t)
		access.EXPECT().GetConnectionSpec(mock.Anything, "test-connection").Return(testAuthorizeConnection(), nil)
		access.EXPECT().GetConnection(mock.Anything, "test-connection").Return(oauthConn, nil)
		access.EXPECT().GetClient().Return(fakeClient)
		handler := newAuthorizeHandler(t, access, responder)

		handler.ServeHTTP(httptest.NewRecorder(), newAuthorizeRequest(`{"spec":{"code":"abc","redirectURI":"https://grafana.example.com/callback"}}`))

		require.True(t, responder.called)
		require.Nil(t, responder.err)
		require.Equal(t, http.StatusOK, responder.code)

		resp, ok := responder.obj.(*provisioning.ConnectionAuthorizeRequest)
		require.True(t, ok)
		require.True(t, resp.Status.Authorized)
		require.Empty(t, resp.Spec.Code)
	})
}

func newAuthorizeHandler(t *testing.T, access ConnectionAuthorizeAccess, responder *mockResponder) http.Handler {
	t.Helper()

	handler, err := NewConnectionAuthorizeConnector(access).Connect(context.Background(), "test-connection", nil, responder)
	require.NoError(t, err)
	require.NotNil(t, handler)
	return handler
}

func newAuthorizeRequest(body string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func testAuthorizeConnection() *provisioning.Connection {
	return &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-connection",
			Namespace: "default",
		},
	}
}

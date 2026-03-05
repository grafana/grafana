package v0alpha1

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
)

func newTestClient(t *testing.T, handler http.Handler) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	cfg := rest.Config{
		Host:    srv.URL,
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			NegotiatedSerializer: &fakeNegotiatedSerializer{},
		},
	}
	client, err := NewClient(cfg, "test-ns")
	require.NoError(t, err)
	return client
}

func TestHistorianClient_NotificationQuery(t *testing.T) {
	var gotPath string
	var gotMethod string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		resp := CreateNotificationqueryResponse{}
		json.NewEncoder(w).Encode(resp)
	})

	client := newTestClient(t, handler)
	_, err := client.NotificationQuery(context.Background(), CreateNotificationqueryRequestBody{})
	require.NoError(t, err)
	require.Equal(t, "POST", gotMethod)
	require.Equal(t, "/apis/historian.alerting.grafana.app/v0alpha1/namespaces/test-ns/notification/query", gotPath)
}

func TestHistorianClient_NotificationsQueryAlerts(t *testing.T) {
	var gotPath string
	var gotMethod string
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		resp := CreateNotificationsqueryalertsResponse{}
		json.NewEncoder(w).Encode(resp)
	})

	client := newTestClient(t, handler)
	_, err := client.NotificationsQueryAlerts(context.Background(), CreateNotificationsqueryalertsRequestBody{})
	require.NoError(t, err)
	require.Equal(t, "POST", gotMethod)
	require.Equal(t, "/apis/historian.alerting.grafana.app/v0alpha1/namespaces/test-ns/notifications/queryalerts", gotPath)
}

type fakeNegotiatedSerializer struct{}

func (f *fakeNegotiatedSerializer) SupportedMediaTypes() []runtime.SerializerInfo { return nil }
func (f *fakeNegotiatedSerializer) EncoderForVersion(serializer runtime.Encoder, gv runtime.GroupVersioner) runtime.Encoder {
	return serializer
}
func (f *fakeNegotiatedSerializer) DecoderToVersion(serializer runtime.Decoder, gv runtime.GroupVersioner) runtime.Decoder {
	return serializer
}

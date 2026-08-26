package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

type fakeClientV3Loader struct {
	client v3.ClientV3
	ok     bool
	gotID  string
}

func (f *fakeClientV3Loader) ClientV3(_ context.Context, id string) (v3.ClientV3, bool) {
	f.gotID = id
	return f.client, f.ok
}

// clientWrapper defers the lookup to request time because the plugin registry
// finishes loading after the API builders are constructed.
func TestClientWrapper(t *testing.T) {
	ctx := context.Background()

	t.Run("calls are forwarded to the loaded client", func(t *testing.T) {
		inner := &fakeRouteClient{}
		loader := &fakeClientV3Loader{client: inner, ok: true}
		wrapper := &clientWrapper{loader: loader, id: "example-app"}

		routeReq := &pluginv3.CallRouteRequest{}
		routeReq.SetPath("things/thing-1/reload")
		stream, err := wrapper.CallRoute(ctx, routeReq)
		require.NoError(t, err)
		require.NotNil(t, stream)
		require.Same(t, routeReq, inner.req)

		// The wrapper is built per plugin and must never look up another one.
		require.Equal(t, "example-app", loader.gotID)
	})

	// Every method has to answer, because a v2 plugin never loads a v3 client.
	t.Run("a plugin with no v3 backend reports unavailable", func(t *testing.T) {
		loader := &fakeClientV3Loader{ok: false}
		wrapper := &clientWrapper{loader: loader, id: "example-app"}

		_, routeErr := wrapper.CallRoute(ctx, &pluginv3.CallRouteRequest{})
		_, admissionErr := wrapper.AdmissionReview(ctx, &pluginv3.AdmissionReviewRequest{})
		_, convertErr := wrapper.ConvertObjects(ctx, &pluginv3.ConvertObjectsRequest{})

		for _, err := range []error{routeErr, admissionErr, convertErr} {
			require.Error(t, err)
			require.True(t, apierrors.IsServiceUnavailable(err),
				"callers rely on the status reason, got %v", err)
		}
	})

	t.Run("admission and conversion reach the loaded client", func(t *testing.T) {
		inner := &fakeAdmissionClient{}
		wrapper := &clientWrapper{
			loader: &fakeClientV3Loader{client: inner, ok: true},
			id:     "example-app",
		}

		admissionReq := &pluginv3.AdmissionReviewRequest{}
		_, err := wrapper.AdmissionReview(ctx, admissionReq)
		require.NoError(t, err)
		require.Same(t, admissionReq, inner.admissionReq)

		convertReq := &pluginv3.ConvertObjectsRequest{}
		_, err = wrapper.ConvertObjects(ctx, convertReq)
		require.NoError(t, err)
		require.Same(t, convertReq, inner.convertReq)
	})
}

// fakeAdmissionClient records the admission and conversion requests it receives.
type fakeAdmissionClient struct {
	v3.ClientV3
	admissionReq *pluginv3.AdmissionReviewRequest
	convertReq   *pluginv3.ConvertObjectsRequest
}

func (f *fakeAdmissionClient) AdmissionReview(_ context.Context, req *pluginv3.AdmissionReviewRequest, _ ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	f.admissionReq = req
	return &pluginv3.AdmissionReviewResponse{}, nil
}

func (f *fakeAdmissionClient) ConvertObjects(_ context.Context, req *pluginv3.ConvertObjectsRequest, _ ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	f.convertReq = req
	return &pluginv3.ConvertObjectsResponse{}, nil
}

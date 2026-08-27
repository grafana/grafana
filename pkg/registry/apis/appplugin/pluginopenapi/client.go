package pluginopenapi

import (
	"context"

	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

var _ v3.ClientV3 = offlineClientV3{}

// offlineClientV3 stands in for the plugin backend. A kind that declares
// admission capabilities is refused a nil client, and the spec describes the
// custom routes this client would serve, so it has to exist -- but rendering a
// spec never starts the plugin.
type offlineClientV3 struct{}

func (offlineClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest, ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	return nil, errOffline
}

func (offlineClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest, ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return nil, errOffline
}

func (offlineClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest, ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	return nil, errOffline
}

var errOffline = apierrors.NewServiceUnavailable("the plugin backend is not running")

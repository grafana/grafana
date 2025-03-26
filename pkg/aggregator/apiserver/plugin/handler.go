package plugin

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/runtime/serializer"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	backendHandler "github.com/grafana/grafana/pkg/aggregator/apiserver/backend"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/admission"
)

type PluginClient interface {
	backend.QueryDataHandler
	backend.AdmissionHandler
}

type PluginContextProvider interface {
	GetPluginContext(ctx context.Context, pluginID, uid string) (backend.PluginContext, error)
}

type PluginHandler struct {
	client                PluginClient
	pluginContextProvider PluginContextProvider
	dataplaneService      aggregationv0alpha1.DataPlaneService
	admissionCodecs       serializer.CodecFactory
}

func NewPluginHandler(
	client PluginClient,
	dataplaneService aggregationv0alpha1.DataPlaneService,
	pluginContextProvider PluginContextProvider,
	delegate http.Handler,
) http.Handler {
	h := &PluginHandler{
		client:                client,
		pluginContextProvider: pluginContextProvider,
		dataplaneService:      dataplaneService,
		admissionCodecs:       admission.GetCodecs(),
	}

	return backendHandler.NewBackendHandler(h, delegate, dataplaneService)
}

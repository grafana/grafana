package queries

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type ServiceHTTPHandler interface {
	registry.CanBeDisabled
	RegisterHTTPRoutes(routes routing.RouteRegister)
}

type queriesServiceHTTPHandler struct {
	service  Service
	features featuremgmt.FeatureToggles
}

func (s queriesServiceHTTPHandler) IsDisabled() bool {
	return !s.features.IsEnabled(featuremgmt.FlagSavedQueries)
}

func (s queriesServiceHTTPHandler) RegisterHTTPRoutes(routes routing.RouteRegister) {

}

func ProvideServiceHTTPHandler(
	queriesService Service,
	features featuremgmt.FeatureToggles,
) ServiceHTTPHandler {
	return &queriesServiceHTTPHandler{
		service:  queriesService,
		features: features,
	}
}

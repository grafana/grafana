package api

import (
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/web"
)

func (api *API) authorize(method, path string) web.Handler {
	// TODO Add fine-grained authorization for every route
	return middleware.ReqSignedIn
}

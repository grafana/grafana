package signingkeysimpl

import (
	"net/http"

	"github.com/go-jose/go-jose/v3"

	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func registerRoutes(router routing.RouteRegister, s service) {
	router.Get("/api/.well-known/jwks.json", handleGetJWKS(s))
}

type service interface {
	GetJWKS() jose.JSONWebKeySet
}

type api struct {
	service service
}

func handleGetJWKS(s service) web.Handler {
	return func(c *contextmodel.ReqContext) {
		c.JSON(http.StatusOK, s.GetJWKS())
	}
}

func getJWKS() {}

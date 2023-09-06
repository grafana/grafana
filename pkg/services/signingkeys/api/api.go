package api

import (
	"net/http"

	"github.com/go-jose/go-jose/v3"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/signingkeys"
)

type SigningKeysApi struct {
	service       signingkeys.Service
	routeRegister routing.RouteRegister
}

func NewSigningKeysAPI(
	service signingkeys.Service,
	routeRegister routing.RouteRegister,
) *SigningKeysApi {
	return &SigningKeysApi{
		service:       service,
		routeRegister: routeRegister,
	}
}

func (api *SigningKeysApi) RegisterAPIEndpoints() {
	api.routeRegister.Group("/api/jwks", func(serviceAccountsRoute routing.RouteRegister) {
		serviceAccountsRoute.Get("/", routing.Wrap(api.GetJWKS))
		serviceAccountsRoute.Get("/:id", routing.Wrap(api.GetJWK))
	})
}

func (api *SigningKeysApi) GetJWKS(c *contextmodel.ReqContext) response.Response {
	return response.JSON(http.StatusOK, api.service.GetJWKS())
}

func (api *SigningKeysApi) GetJWK(c *contextmodel.ReqContext) response.Response {
	keyID := c.Query("id")
	jwk, err := api.service.GetJWK(keyID)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, jose.JSONWebKeySet{Keys: []jose.JSONWebKey{jwk}})
}

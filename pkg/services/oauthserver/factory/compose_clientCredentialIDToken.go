package factory

import (
	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/openid"

	"github.com/grafana/grafana/pkg/services/oauthserver/handler"
)

func ClientCredentialsIDTokenProviderFactory(config fosite.Configurator, storage interface{}, strategy interface{}) interface{} {
	return &handler.ClientCredentialsGrantHandler{
		IDTokenHandleHelper: &openid.IDTokenHandleHelper{
			IDTokenStrategy: strategy.(openid.OpenIDConnectTokenStrategy),
		},
		Config: config,
	}
}

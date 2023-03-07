package factory

import (
	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/openid"

	"github.com/grafana/grafana/pkg/services/oauthserver/handler"
)

func RFC7523IDTokenProviderFactory(config fosite.Configurator, storage interface{}, strategy interface{}) interface{} {
	return &handler.OpenIDConnectRFC7523Handler{
		IDTokenHandleHelper: &openid.IDTokenHandleHelper{
			IDTokenStrategy: strategy.(openid.OpenIDConnectTokenStrategy),
		},
		Config: config,
	}
}

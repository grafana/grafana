package gitoauth

import (
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

type provider struct {
	endpoint oauth2.Endpoint
}

func (p *provider) Endpoint() oauth2.Endpoint {
	return p.endpoint
}

var _ oauth.Provider = (*provider)(nil)

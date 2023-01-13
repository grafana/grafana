package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ authn.Client = new(Proxy)

func ProvideProxy(cfg *setting.Cfg) *Proxy {
	return &Proxy{cfg}
}

type Proxy struct {
	cfg *setting.Cfg
}

func (p *Proxy) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	//TODO implement me
	panic("implement me")
}

func (p *Proxy) Test(ctx context.Context, r *authn.Request) bool {
	return len(p.getHeader(r)) != 0
}

func (p *Proxy) getHeader(r *authn.Request) string {
	if r.HTTPRequest == nil {
		return ""
	}
	v := r.HTTPRequest.Header.Get(p.cfg.AuthProxyHeaderName)
	if p.cfg.AuthProxyHeadersEncoded {
		v = util.DecodeQuotedPrintable(v)
	}
	return v
}

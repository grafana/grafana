package anonimpl

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/web"
)

type AnonSessionService struct {
	remoteCache remotecache.CacheStorage
	log         log.Logger
}

func ProvideAnonymousSessionService(remoteCache remotecache.CacheStorage) *AnonSessionService {
	return &AnonSessionService{
		remoteCache: remoteCache,
		log:         log.New("anonymous-session-service"),
	}
}

func (a *AnonSessionService) TagSession(ctx context.Context, httpReq *http.Request) error {
	addr := web.RemoteAddr(httpReq)
	_, err := network.GetIPFromAddress(addr)
	if err != nil {
		a.log.Debug("failed to parse ip from address", "addr", addr)
		return nil
	}

	// now := time.Now()
	// clientIPStr := ip.String()
	// if len(ip) == 0 {
	// 	clientIPStr = ""
	// }

	return nil
}

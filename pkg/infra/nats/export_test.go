package nats

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
)

// These let the external tests, which can import Secrets Manager, drive the
// helpers of the internal ones.

func NewEmbeddedTestCfg(listen string) *setting.Cfg { return newEmbeddedTestCfg(listen, "") }

func StartService(t *testing.T, s *Server) { startService(t, t.Context(), s) }

func RequireDelivery(t *testing.T, from, to *Server) { requireDelivery(t, from, to) }

func DeleteRouteCredential(t *testing.T, sqlStore db.DB) { deleteRouteCredential(t, sqlStore) }

// RouteCredentialKeyPath is the key_path of the route credential row.
var RouteCredentialKeyPath = "nats/peers/" + routeCredentialKey(discoveryClusterName)

// RouteCredential returns the loaded route credential, nil while the server
// waits for it.
func RouteCredential(s *Server) *url.Userinfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.routeAuth
}

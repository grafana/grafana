// Package pluginrouter selects only the app plugins whose Live RPCs are sent
// to the App Platform router. It does not replace the plugin backend provider.
package pluginrouter

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	v2 "github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/grpctls"
	"google.golang.org/grpc"
)

type Client struct {
	ids     map[string]struct{}
	conn    *grpc.ClientConn
	handler backend.StreamHandler
}

func New(cfg *setting.Cfg) (*Client, error) {
	sec := cfg.SectionWithEnvOverrides("live.plugin_router")
	ids := strings.Fields(sec.Key("plugin_ids").String())
	if len(ids) == 0 {
		return nil, nil
	}
	addr := sec.Key("address").String()
	if addr == "" {
		return nil, fmt.Errorf("live.plugin_router requires address")
	}
	pem, e := os.ReadFile(sec.Key("ca_file").String())
	if e != nil {
		return nil, fmt.Errorf("live router CA: %w", e)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(pem) {
		return nil, fmt.Errorf("invalid live router CA")
	}
	tlsCfg := &tls.Config{RootCAs: roots, ServerName: sec.Key("server_name").String(), MinVersion: tls.VersionTLS13}
	if err := grpctls.UseClientCertificate(tlsCfg, sec.Key("cert_file").String(), sec.Key("key_file").String()); err != nil {
		return nil, fmt.Errorf("live router client certificate: %w", err)
	}
	conn, e := grpc.NewClient(addr, grpc.WithDisableRetry(), grpc.WithTransportCredentials(grpctls.ClientCredentials(tlsCfg)))
	if e != nil {
		return nil, e
	}
	c := &Client{ids: map[string]struct{}{}, conn: conn, handler: &grpcplugin.ClientV2{StreamClient: v2.NewStreamClient(conn)}}
	for _, id := range ids {
		c.ids[id] = struct{}{}
	}
	return c, nil
}
func (c *Client) Handler(id string) (backend.StreamHandler, bool) {
	if c == nil {
		return nil, false
	}
	_, ok := c.ids[id]
	return c.handler, ok
}
func (c *Client) Close() {
	if c != nil {
		_ = c.conn.Close()
	}
}

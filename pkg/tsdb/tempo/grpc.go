package tempo

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/tempo/pkg/tempopb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

// This function creates a new gRPC client to connect to a streaming query service.
// It starts by parsing the URL from the data source settings and extracting the host, since that's what the gRPC connection expects.
// If the URL does not contain a port number, it adds a default port based on the scheme (80 for HTTP and 443 for HTTPS).
// If basic authentication is enabled, it uses TLS transport credentials and sets the basic authentication header for each RPC call.
// Otherwise, it uses insecure credentials.
func newGrpcClient(settings backend.DataSourceInstanceSettings, opts httpclient.Options) (tempopb.StreamingQuerierClient, error) {
	parsedUrl, err := url.Parse(settings.URL)
	if err != nil {
		return nil, err
	}

	onlyHost := parsedUrl.Host
	if !strings.Contains(onlyHost, ":") {
		if parsedUrl.Scheme == "http" {
			onlyHost += ":80"
		} else {
			onlyHost += ":443"
		}
	}

	var dialOps []grpc.DialOption
	if settings.BasicAuthEnabled {
		dialOps = append(dialOps, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
		dialOps = append(dialOps, grpc.WithPerRPCCredentials(&basicAuth{
			Header: basicHeaderForAuth(opts.BasicAuth.User, opts.BasicAuth.Password),
		}))
	} else {
		dialOps = append(dialOps, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	clientConn, err := grpc.Dial(onlyHost, dialOps...)
	if err != nil {
		return nil, err
	}
	return tempopb.NewStreamingQuerierClient(clientConn), nil
}

type basicAuth struct {
	Header string
}

func (c *basicAuth) GetRequestMetadata(context.Context, ...string) (map[string]string, error) {
	return map[string]string{
		"Authorization": c.Header,
	}, nil
}

func (c *basicAuth) RequireTransportSecurity() bool {
	return true
}

func basicHeaderForAuth(username, password string) string {
	return fmt.Sprintf("Basic %s", base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", username, password))))
}

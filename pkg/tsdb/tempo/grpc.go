package tempo

import (
	connect_go "github.com/bufbuild/connect-go"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var logger = backend.NewLoggerWith("logger", "tsdb.tempo")

// This function creates a new gRPC client to connect to a streaming query service.
// It starts by parsing the URL from the data source settings and extracting the host, since that's what the gRPC connection expects.
// If the URL does not contain a port number, it adds a default port based on the scheme (80 for HTTP and 443 for HTTPS).
// If basic authentication is enabled, it uses TLS transport credentials and sets the basic authentication header for each RPC call.
// Otherwise, it uses insecure credentials.
func newGrpcClient(client *http.Client, settings backend.DataSourceInstanceSettings) (TempoServiceClient, error) {
	parsedUrl, err := url.Parse(settings.URL)
	if err != nil {
		logger.Error("Error parsing URL for gRPC client", "error", err, "URL", settings.URL, "function", logEntrypoint())
		return nil, err
	}

	var port string
	if parsedUrl.Scheme == "http" {
		port = "80"
	} else {
		port = "443"
	}

	final := parsedUrl.Scheme + "://" + strings.Split(parsedUrl.Host, ":")[0] + ":" + port
	logger.Warn("client url", "settings.URL", settings.URL, "final", final)
	tempoClient := NewQuerierServiceClient(client, settings.URL, connect_go.WithGRPC())
	return tempoClient, nil
}

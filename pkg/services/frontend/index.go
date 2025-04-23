package frontend

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type IndexProvider struct {
	log    logging.Logger
	assets *dtos.EntryPointAssets
}

func NewIndexProvider(cfg *setting.Cfg, license licensing.Licensing) (*IndexProvider, error) {
	assets, err := webassets.GetWebAssets(context.Background(), cfg, license)
	if err != nil {
		return nil, err
	}

	return &IndexProvider{
		log:    logging.DefaultLogger.With("logger", "index-provider"),
		assets: assets,
	}, nil
}

func (p *IndexProvider) HandleRequest(writer http.ResponseWriter, request *http.Request) {
	if request.Method != "GET" {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	nonce, err := generateNonce()
	if err != nil {
		p.log.Error("error creating nonce", "err", err)
		writer.WriteHeader(500)
		return
	}
	// This should:
	// - call http://slug/api/bootdata
	// - render index.html with the bootdata
	// - something-something-something frontend assets
	// - return it to the user!

	jj, err := json.MarshalIndent(p.assets, "", "  ")
	if err != nil {
		p.log.Error("error creating nonce", "err", err)
		writer.WriteHeader(500)
		return
	}

	p.log.Info("handling request", "method", request.Method, "url", request.URL.String())
	htmlContent := `<!DOCTYPE html>
<html>
<head>
    <title>Grafana Frontend Server</title>
    <style>
        body {
            font-family: sans-serif;
        }
    </style>
</head>
<body>
    <h1>Grafana Frontend Server</h1>
    <p>This is a simple static HTML page served by the Grafana frontend server module.</p>
		<p>NONCE: ` + nonce + `</p>
		<pre>Assets: ` + string(jj) + `</pre>
</body>
</html>`

	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err = writer.Write([]byte(htmlContent))
	if err != nil {
		p.log.Error("could not write to response", "err", err)
	}
}

func generateNonce() (string, error) {
	var buf [16]byte
	if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(buf[:]), nil
}

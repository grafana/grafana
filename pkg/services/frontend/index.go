package frontend

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/base64"
	"errors"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type IndexProvider struct {
	log   logging.Logger
	index *template.Template
	data  IndexViewData
}

type IndexViewData struct {
	CSPContent       string
	CSPEnabled       bool
	IsDevelopmentEnv bool

	AppSubUrl    string
	BuildVersion string
	BuildCommit  string
	AppTitle     string

	Assets *dtos.EntryPointAssets // Includes CDN info

	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string
}

const (
	headerContentType = "Content-Type"
	contentTypeHTML   = "text/html; charset=UTF-8"
)

// Templates setup.
var (
	//go:embed *.html
	templatesFS embed.FS

	// templates
	htmlTemplates = template.Must(template.New("html").Delims("[[", "]]").ParseFS(templatesFS, `*.html`))
)

func NewIndexProvider(cfg *setting.Cfg, license licensing.Licensing) (*IndexProvider, error) {
	assets, err := webassets.GetWebAssets(context.Background(), cfg, license)
	if err != nil {
		return nil, err
	}
	t := htmlTemplates.Lookup("index.html")
	if t == nil {
		return nil, fmt.Errorf("missing index template")
	}

	return &IndexProvider{
		log:   logging.DefaultLogger.With("logger", "index-provider"),
		index: t,
		data: IndexViewData{
			AppTitle:     "Grafana",
			AppSubUrl:    cfg.AppSubURL,
			BuildVersion: cfg.BuildVersion,
			BuildCommit:  cfg.BuildCommit,
			Assets:       assets,
		},
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

	data := p.data // copy everything
	data.Nonce = nonce

	writer.Header().Set(headerContentType, contentTypeHTML)
	writer.WriteHeader(200)
	if err := p.index.Execute(writer, &data); err != nil {
		if errors.Is(err, syscall.EPIPE) { // Client has stopped listening.
			return
		}
		panic(fmt.Sprintf("Error rendering index\n %s", err.Error()))
	}
}

func generateNonce() (string, error) {
	var buf [16]byte
	if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(buf[:]), nil
}

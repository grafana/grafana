package frontend

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/middleware"
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
			AppSubUrl:    cfg.AppSubURL, // Based on the request?
			BuildVersion: cfg.BuildVersion,
			BuildCommit:  cfg.BuildCommit,
			Assets:       assets,

			CSPEnabled: cfg.CSPEnabled,
			CSPContent: cfg.CSPTemplate,

			IsDevelopmentEnv: cfg.Env == setting.Dev,
		},
	}, nil
}

func (p *IndexProvider) HandleRequest(writer http.ResponseWriter, request *http.Request) {
	if request.Method != "GET" {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	nonce, err := middleware.GenerateNonce()
	if err != nil {
		p.log.Error("error creating nonce", "err", err)
		writer.WriteHeader(500)
		return
	}

	// TODO -- restructure so the static stuff is under one variable and the rest is dynamic
	data := p.data // copy everything
	data.Nonce = nonce

	if data.CSPEnabled {
		data.CSPContent = middleware.ReplacePolicyVariables(p.data.CSPContent, p.data.AppSubUrl, data.Nonce)
	}

	writer.Header().Set("Content-Type", "text/html; charset=UTF-8")
	writer.WriteHeader(200)
	if err := p.index.Execute(writer, &data); err != nil {
		if errors.Is(err, syscall.EPIPE) { // Client has stopped listening.
			return
		}
		panic(fmt.Sprintf("Error rendering index\n %s", err.Error()))
	}
}

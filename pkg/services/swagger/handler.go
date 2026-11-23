package swagger

import (
	"embed"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"syscall"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// buildDir is the bundler output directory holding the swagger app. It must
// match the output path configured in scripts/rspack/rspack.swagger.ts.
const buildDir = "build-swagger"

//go:embed swagger.html
var templatesFS embed.FS

var indexTemplate = template.Must(template.New("swagger.html").Delims("[[", "]]").ParseFS(templatesFS, "swagger.html"))

type indexViewData struct {
	IsDevelopmentEnv bool

	Assets *dtos.EntryPointAssets

	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string

	CSPEnabled bool
	CSPContent string
}

// handler renders the swagger page. The core HTTP server and the standalone
// swagger-server target both use it, so the page is the same in either mode.
type handler struct {
	cfg     *setting.Cfg
	license licensing.Licensing
}

// RegisterRoutes mounts the swagger routes on the core HTTP server. It is called
// by the HTTP server rather than wired as a service, so adding or changing it
// does not touch the OSS or Enterprise wire graphs.
func RegisterRoutes(rr routing.RouteRegister, cfg *setting.Cfg, license licensing.Licensing) {
	newHandler(cfg, license).registerRoutes(rr)
}

func newHandler(cfg *setting.Cfg, license licensing.Licensing) *handler {
	return &handler{cfg: cfg, license: license}
}

func (h *handler) registerRoutes(rr routing.RouteRegister) {
	// Deprecated
	rr.Get("/swagger-ui", handleRedirect)

	rr.Get("/swagger", h.handleRequest)
}

func handleRedirect(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "swagger", http.StatusMovedPermanently)
}

func (h *handler) handleRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	assets, err := webassets.GetWebAssets(ctx, buildDir, h.cfg, h.license)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	// The CSP middleware generates the nonce. When CSP is disabled there is no
	// nonce, and the template renders empty nonce attributes.
	var nonce string
	if reqCtx := contexthandler.FromContext(ctx); reqCtx != nil {
		nonce = reqCtx.RequestNonce
	}

	data := indexViewData{
		IsDevelopmentEnv: h.cfg.Env == setting.Dev,
		Assets:           assets,
		Nonce:            nonce,
	}

	if h.cfg.CSPEnabled {
		data.CSPEnabled = true
		hosts := middleware.CSPHostLists{FormActionAdditionalHosts: h.cfg.FormActionAdditionalHosts}
		data.CSPContent = middleware.ReplacePolicyVariables(h.cfg.CSPTemplate, h.cfg.AppURL, hosts, nonce)
	}

	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	w.WriteHeader(http.StatusOK)
	if err := indexTemplate.Execute(w, &data); err != nil {
		if errors.Is(err, syscall.EPIPE) { // Client has stopped listening.
			return
		}
		panic(fmt.Sprintf("Error rendering swagger\n %s", err.Error()))
	}
}

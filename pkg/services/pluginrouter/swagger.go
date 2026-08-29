package pluginrouter

import (
	"html/template"
	"net/http"
	"path/filepath"

	"github.com/gorilla/mux"

	"github.com/grafana/grafana/pkg/api/webassets"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// swaggerBuildDir is the frontend bundle the API navigator is built into,
	// the same one Grafana's own /swagger serves.
	swaggerBuildDir = "build-swagger"

	// swaggerTemplate is the page that loads that bundle, read from the static
	// root rather than embedded so it stays the one Grafana renders.
	swaggerTemplate = "swagger.html"

	// templateDelimLeft and templateDelimRight are the delimiters Grafana's
	// views use, chosen so the templates stay valid HTML with Angular in them.
	templateDelimLeft  = "[["
	templateDelimRight = "]]"
)

// swaggerUI serves the API navigator over the groups this target routes.
//
// The page is Grafana's own: it reads /openapi/v3 for the list of documents to
// offer, which is exactly what the router synthesizes, so every plugin group
// shows up in its picker with no extra wiring. The endpoints it also looks for
// -- the user, the frontend settings, the core Grafana specs -- are not served
// by this target, and the page already degrades when they are missing.
type swaggerUI struct {
	staticRoot string
	cfg        *setting.Cfg
	license    licensing.Licensing
}

func newSwaggerUI(cfg *setting.Cfg, license licensing.Licensing) *swaggerUI {
	return &swaggerUI{staticRoot: cfg.StaticRootPath, cfg: cfg, license: license}
}

// register mounts the navigator and the assets it loads. The root redirect that
// leads here belongs to the service, which knows whether a caller has to sign
// in first.
func (s *swaggerUI) register(httpRouter *mux.Router) {
	httpRouter.Path("/swagger").HandlerFunc(s.serve)
	httpRouter.PathPrefix("/public/").Handler(
		http.StripPrefix("/public/", http.FileServer(http.Dir(s.staticRoot))))
}

func (s *swaggerUI) serve(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()

	page, err := template.New(swaggerTemplate).
		Delims(templateDelimLeft, templateDelimRight).
		ParseFiles(filepath.Join(s.staticRoot, "views", swaggerTemplate))
	if err != nil {
		// The frontend is built separately from the backend, so a backend-only
		// checkout reaches here. Say which build is missing rather than 500.
		http.Error(w, "the API navigator needs the frontend build: run yarn build ("+err.Error()+")",
			http.StatusServiceUnavailable)
		return
	}

	assets, err := webassets.GetWebAssets(ctx, swaggerBuildDir, s.cfg, s.license)
	if err != nil {
		http.Error(w, "the API navigator needs the frontend build: run yarn build ("+err.Error()+")",
			http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// No CSP is set on this response, so the template's nonce is left empty
	// rather than minted for a policy nothing enforces.
	if err := page.Execute(w, map[string]any{"Assets": assets}); err != nil {
		// The status is already written by now, so there is nothing to send but
		// a log line.
		s.cfg.Logger.Error("failed to render the API navigator", "error", err)
	}
}

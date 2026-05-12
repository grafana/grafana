package plugin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

var (
	_ backend.CallResourceHandler   = (*App)(nil)
	_ backend.CheckHealthHandler    = (*App)(nil)
	_ instancemgmt.InstanceDisposer = (*App)(nil)
)

type App struct {
	backend.CallResourceHandler
	settings backend.AppInstanceSettings
}

func New(_ context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	app := &App{settings: settings}

	mux := http.NewServeMux()
	mux.HandleFunc("/test", app.handleTest)

	app.CallResourceHandler = httpadapter.New(mux)
	return app, nil
}

func (a *App) Dispose() {}

func (a *App) CheckHealth(_ context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "ok",
	}, nil
}

func (a *App) handleTest(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		hashes := make(map[string]string, len(a.settings.DecryptedSecureJSONData))
		for k, v := range a.settings.DecryptedSecureJSONData {
			sum := sha256.Sum256([]byte(v))
			hashes[k] = hex.EncodeToString(sum[:])
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{"secureValueHashes": hashes}); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	case http.MethodPost:
		w.WriteHeader(http.StatusCreated)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

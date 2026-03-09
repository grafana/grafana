package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/ingestinstance"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	"github.com/grafana/grafana/pkg/web"
)

var pluginWebhookLogger = log.New("plugin.webhook")

// IngestInstanceStore returns the ingest instance store used by the webhook
// handler. This is exposed so that management APIs and tests can seed
// instances.
func (hs *HTTPServer) IngestInstanceStore() ingestinstance.Store {
	return hs.ingestInstanceStore
}

// HandlePluginWebhook handles unauthenticated alert ingestion requests for
// alerting plugins. The URL-embedded token is the credential: it resolves to
// an org, plugin, and instance config. The handler builds a PluginContext
// with the instance settings as AppInstanceSettings.JSONData, forwards the
// request to the plugin's CallResource handler, then takes the plugin's
// response (a JSON array of PostableAlerts) and submits them directly to
// Grafana's built-in Alertmanager via the internal PutAlerts API.
//
// Route: POST /api/plugins/:pluginId/alert/:token/*
// Route: POST /api/plugins/:pluginId/alert/:token
// maxWebhookBodySize is the maximum allowed request body for webhook ingestion.
// This endpoint is unauthenticated, so a limit prevents abuse.
const maxWebhookBodySize = 1 << 20 // 1 MiB

// defaultAlertLifetime is used when alert_lifetime is not configured on an
// instance. External services send discrete "firing" and "resolved" webhooks
// rather than continuous pushes, so alerts need a long enough lifetime to
// avoid Alertmanager's default 5-minute auto-resolve.
const defaultAlertLifetime = 24 * time.Hour

// instanceSettingsLifetime is a minimal struct for extracting the
// alert_lifetime field from the opaque instance settings JSON.
type instanceSettingsLifetime struct {
	AlertLifetime string `json:"alert_lifetime"`
}

func (hs *HTTPServer) HandlePluginWebhook(w http.ResponseWriter, r *http.Request) {
	logger := pluginWebhookLogger

	// Enforce body size limit on this unauthenticated endpoint.
	r.Body = http.MaxBytesReader(w, r.Body, maxWebhookBodySize)

	params := web.Params(r)
	pluginID := params[":pluginId"]
	token := params[":token"]

	// 1. Look up the plugin and verify it exists and is an alerting plugin.
	p, exists := hs.pluginStore.Plugin(r.Context(), pluginID)
	if !exists {
		http.Error(w, "Plugin not found", http.StatusNotFound)
		return
	}
	// POC: accept app-type plugins for webhook ingestion. In production,
	// this would check for TypeAlerting once the frontend supports it.
	if p.Type != plugins.TypeApp {
		http.Error(w, "Plugin is not an alerting plugin", http.StatusForbidden)
		return
	}

	// 2. Validate the token against the instance store.
	instance, err := hs.ingestInstanceStore.GetByToken(r.Context(), token)
	if err != nil {
		if errors.Is(err, ingestinstance.ErrInstanceNotFound) {
			http.Error(w, "Invalid webhook token", http.StatusUnauthorized)
			return
		}
		logger.Error("Failed to look up ingest instance", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// 3. Verify the token belongs to the requested plugin.
	if instance.PluginID != pluginID {
		http.Error(w, "Invalid webhook token", http.StatusUnauthorized)
		return
	}

	// 4. Build PluginContext manually. There is no signed-in user — the token
	//    is the auth. We set OrgID from the instance and deliver the instance
	//    settings as AppInstanceSettings.JSONData so the plugin can read its
	//    config the same way app plugins do.
	pCtx := backend.PluginContext{
		OrgID:         instance.OrgID,
		PluginID:      pluginID,
		PluginVersion: p.Info.Version,
		AppInstanceSettings: &backend.AppInstanceSettings{
			JSONData: instance.Settings,
		},
	}

	// 5. Build the forwarded request. Strip the webhook prefix from the path
	//    so the plugin sees a clean resource path (e.g. "/ingest").
	resourcePath := params["*"]
	if resourcePath == "" {
		resourcePath = "/"
	}

	clonedReq := r.Clone(r.Context())
	clonedReq.URL = &url.URL{
		Path:     resourcePath,
		RawQuery: r.URL.RawQuery,
	}
	proxyutil.PrepareProxyRequest(clonedReq)

	body, err := io.ReadAll(clonedReq.Body)
	if err != nil {
		logger.Error("Failed to read request body", "error", err)
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}

	// 6. Call the plugin's CallResource handler and capture the response.
	crReq := &backend.CallResourceRequest{
		PluginContext: pCtx,
		Path:          clonedReq.URL.Path,
		Method:        clonedReq.Method,
		URL:           clonedReq.URL.String(),
		Headers:       clonedReq.Header,
		Body:          body,
	}

	capture := &responseCapturer{}
	if err := hs.pluginClient.CallResource(r.Context(), crReq, capture); err != nil {
		logger.Error("Plugin resource request failed", "pluginId", pluginID, "error", err)
		http.Error(w, "Failed to call plugin resource", http.StatusInternalServerError)
		return
	}

	// 7. Check the plugin response status. Non-2xx means the plugin rejected
	//    the payload — forward the error to the caller.
	if capture.status < 200 || capture.status >= 300 {
		w.WriteHeader(capture.status)
		_, _ = w.Write(capture.body)
		return
	}

	// 8. Parse the PostableAlerts from the plugin's response body.
	var alerts []amv2.PostableAlert
	if err := json.Unmarshal(capture.body, &alerts); err != nil {
		logger.Error("Failed to parse alerts from plugin response", "pluginId", pluginID, "error", err)
		http.Error(w, "Plugin returned invalid alert payload", http.StatusBadGateway)
		return
	}

	if len(alerts) == 0 {
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"message":"no alerts to submit"}`))
		return
	}

	// 9. Apply timing defaults so plugins don't have to worry about
	//    Alertmanager's timing model. Plugins can still set explicit
	//    StartsAt/EndsAt values (e.g. from payload fields), and those
	//    are preserved.
	lifetime := defaultAlertLifetime
	var lifetimeCfg instanceSettingsLifetime
	if err := json.Unmarshal(instance.Settings, &lifetimeCfg); err == nil && lifetimeCfg.AlertLifetime != "" {
		if d, err := time.ParseDuration(lifetimeCfg.AlertLifetime); err == nil {
			lifetime = d
		}
	}

	now := time.Now()
	for i := range alerts {
		if time.Time(alerts[i].StartsAt).IsZero() {
			alerts[i].StartsAt = strfmt.DateTime(now)
		}
		if time.Time(alerts[i].EndsAt).IsZero() {
			alerts[i].EndsAt = strfmt.DateTime(now.Add(lifetime))
		}
	}

	// 10. Submit the alerts to the built-in Alertmanager via internal Go API.
	am, err := hs.AlertNG.MultiOrgAlertmanager.AlertmanagerFor(instance.OrgID)
	if err != nil {
		if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) || errors.Is(err, notifier.ErrAlertmanagerNotReady) {
			logger.Error("Alertmanager not available for org", "orgId", instance.OrgID, "error", err)
			http.Error(w, "Alertmanager not available", http.StatusServiceUnavailable)
			return
		}
		logger.Error("Failed to get Alertmanager for org", "orgId", instance.OrgID, "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	postable := apimodels.PostableAlerts{
		PostableAlerts: alerts,
	}
	if err := am.PutAlerts(r.Context(), postable); err != nil {
		logger.Error("Failed to submit alerts to Alertmanager", "pluginId", pluginID, "orgId", instance.OrgID, "error", err)
		http.Error(w, "Failed to submit alerts", http.StatusBadGateway)
		return
	}

	logger.Info("Submitted alerts to Alertmanager", "pluginId", pluginID, "orgId", instance.OrgID, "count", len(alerts))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_, _ = w.Write([]byte(fmt.Sprintf(`{"message":"accepted","alertCount":%d}`, len(alerts))))
}

// responseCapturer implements backend.CallResourceResponseSender by buffering
// the first response frame in memory. This is used by HandlePluginWebhook to
// capture the plugin's response for post-processing (parsing alerts) rather
// than streaming it directly to the external caller.
type responseCapturer struct {
	status int
	body   []byte
}

func (c *responseCapturer) Send(resp *backend.CallResourceResponse) error {
	if resp == nil {
		return errors.New("resp cannot be nil")
	}
	// Only capture the first frame (alerting plugins send a single response).
	if c.body == nil {
		c.status = resp.Status
		c.body = resp.Body
	} else {
		c.body = append(c.body, resp.Body...)
	}
	return nil
}

package frontend

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/log"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// ShortURLHandler handles short URL resolution
type ShortURLHandler interface {
	ResolveShortURL(ctx context.Context, req *http.Request, uid string) (string, error)
}

// shortURLK8sHandler implements ShortURLHandler using Kubernetes API
type shortURLK8sHandler struct {
	clientProvider grafanaapiserver.DirectRestConfigProvider
	namespacer     request.NamespaceMapper
	gvr            schema.GroupVersionResource
	log            log.Logger
}

// NewShortURLK8sHandler creates a new Kubernetes-based short URL handler
func NewShortURLK8sHandler(cfg *setting.Cfg, namespacer request.NamespaceMapper, gvr schema.GroupVersionResource) ShortURLHandler {
	return &shortURLK8sHandler{
		clientProvider: &shortURLDirectRestConfigProvider{
			cfg: cfg,
			log: log.New("shorturl-k8s-client"),
		},
		namespacer: namespacer,
		gvr:        gvr,
		log:        log.New("shorturl-handler"),
	}
}

func (h *shortURLK8sHandler) ResolveShortURL(ctx context.Context, req *http.Request, uid string) (string, error) {
	h.log.Info("Starting short URL resolution", "uid", uid, "orgId", req.URL.Query().Get("orgId"))

	// Create ReqContext for the handler - need to properly create web.Context
	webCtx := &web.Context{
		Req: req,
	}
	reqContext := &contextmodel.ReqContext{
		Context: webCtx,
		Logger:  h.log,
	}

	// Get Kubernetes client
	client, ok := h.getK8sClient(reqContext)
	if !ok {
		h.log.Error("Failed to create Kubernetes client for short URL resolution", "uid", uid)
		return "", fmt.Errorf("failed to create kubernetes client")
	}

	h.log.Debug("Successfully created Kubernetes client", "uid", uid)

	// Get the short URL resource
	shortURL, err := client.Get(ctx, uid, v1.GetOptions{})
	if err != nil {
		h.log.Error("Failed to fetch short URL from Kubernetes", "uid", uid, "error", err)
		return "", fmt.Errorf("failed to get short URL: %w", err)
	}

	h.log.Debug("Successfully fetched short URL from Kubernetes", "uid", uid)

	// Update lastSeenAt timestamp to track when short URL was accessed
	if err := h.updateLastSeenAt(ctx, client, shortURL, uid); err != nil {
		h.log.Warn("Failed to update lastSeenAt timestamp", "uid", uid, "error", err)
		// Don't fail the request if we can't update the timestamp
	}

	// Extract target URL from the resource
	spec, ok := shortURL.Object["spec"].(map[string]interface{})
	if !ok {
		h.log.Error("Invalid short URL spec structure", "uid", uid, "object", shortURL.Object)
		return "", fmt.Errorf("invalid short URL spec")
	}

	// The Kubernetes short URL resource uses 'path' instead of 'targetUrl'
	targetPath, ok := spec["path"].(string)
	if !ok || targetPath == "" {
		h.log.Error("Missing or invalid path in short URL spec", "uid", uid, "spec", spec)
		return "", fmt.Errorf("missing or invalid path in short URL")
	}

	// Convert the path to a full URL (prepend with '/') if needed
	if !strings.HasPrefix(targetPath, "/") {
		targetPath = "/" + targetPath
	}

	// Security: Prevent open redirect attacks via double slash or slash-backslash
	// After normalization, ensure the second character (if it exists) is not '/' or '\'
	if len(targetPath) > 1 && (targetPath[1] == '/' || targetPath[1] == '\\') {
		h.log.Warn("Blocked potentially malicious redirect path", "uid", uid, "targetPath", targetPath)
		return "", fmt.Errorf("invalid redirect path: potential open redirect attack")
	}

	h.log.Info("Successfully resolved short URL", "uid", uid, "targetPath", targetPath)

	return targetPath, nil
}

// updateLastSeenAt updates the lastSeenAt timestamp for the short URL resource
func (h *shortURLK8sHandler) updateLastSeenAt(ctx context.Context, client dynamic.ResourceInterface, shortURL *unstructured.Unstructured, uid string) error {
	// Get current timestamp
	now := v1.Now()

	// Update the status subresource with lastSeenAt
	status := map[string]interface{}{
		"lastSeenAt": now.Format(time.RFC3339),
	}

	// Try to update status subresource first
	shortURL.Object["status"] = status
	if _, err := client.UpdateStatus(ctx, shortURL, v1.UpdateOptions{}); err != nil {
		h.log.Debug("Failed to update status subresource, trying main resource", "uid", uid, "error", err)

		// If status subresource update fails, update the main resource
		if shortURL.Object["metadata"] == nil {
			shortURL.Object["metadata"] = make(map[string]interface{})
		}
		metadata := shortURL.Object["metadata"].(map[string]interface{})
		if metadata["annotations"] == nil {
			metadata["annotations"] = make(map[string]interface{})
		}
		annotations := metadata["annotations"].(map[string]interface{})
		annotations["shorturl.grafana.app/lastSeenAt"] = now.Format(time.RFC3339)

		if _, err := client.Update(ctx, shortURL, v1.UpdateOptions{}); err != nil {
			return fmt.Errorf("failed to update lastSeenAt in both status and annotations: %w", err)
		}
	}

	h.log.Debug("Successfully updated lastSeenAt timestamp", "uid", uid, "timestamp", now.Format(time.RFC3339))
	return nil
}

// getK8sClient creates a Kubernetes dynamic client for the appropriate namespace
func (h *shortURLK8sHandler) getK8sClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	restConfig := h.clientProvider.GetDirectRestConfig(c)
	if restConfig == nil {
		h.log.Error("Failed to get REST config")
		return nil, false
	}

	dyn, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		h.log.Error("Failed to create dynamic client", "error", err)
		return nil, false
	}

	// Extract and format namespace from the original request
	namespace := h.extractAndFormatNamespace(c.Req)
	return dyn.Resource(h.gvr).Namespace(namespace), true
}

// extractAndFormatNamespace extracts orgId from URL and formats it for namespace mapping
func (h *shortURLK8sHandler) extractAndFormatNamespace(r *http.Request) string {
	// Extract orgId from query parameter (e.g., /goto/abc123?orgId=org-2 or ?orgId=5 or ?orgId=default)
	if orgIDParam := r.URL.Query().Get("orgId"); orgIDParam != "" {
		// If it's a numeric value, use the namespacer to convert it
		if orgID, err := strconv.ParseInt(orgIDParam, 10, 64); err == nil && orgID > 0 {
			namespace := h.namespacer(orgID)
			h.log.Debug("Extracted numeric orgId, converted to namespace", "org_id", orgID, "param_value", orgIDParam, "namespace", namespace)
			return namespace
		}

		// If it's a string (like "org-2" or "default"), return it as-is
		h.log.Debug("Extracted string orgId, using as-is for namespace", "param_value", orgIDParam, "namespace", orgIDParam)
		return orgIDParam
	}

	// Default to org 1 namespace if no orgId parameter found
	defaultNamespace := h.namespacer(1)
	h.log.Debug("No orgId parameter found, using default namespace", "namespace", defaultNamespace)
	return defaultNamespace
}

// shortURLDirectRestConfigProvider provides REST config for short URL K8s operations
type shortURLDirectRestConfigProvider struct {
	cfg *setting.Cfg
	log log.Logger
}

func (f *shortURLDirectRestConfigProvider) GetDirectRestConfig(c *contextmodel.ReqContext) *rest.Config {
	// Read API server URL from config with fallback
	apiServerURL := f.cfg.Raw.Section("kubernetes").Key("api_server_url").MustString("http://grafana-api:3000")

	f.log.Debug("Using API server URL for short URL resolution", "url", apiServerURL)

	return &rest.Config{
		Host: apiServerURL,
		WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
			return &shortURLUserAuthRoundTripper{
				originalRequest: c.Req,
				transport:       rt,
				log:             f.log,
			}
		},
	}
}

func (f *shortURLDirectRestConfigProvider) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Not needed for short URL handler
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

// shortURLUserAuthRoundTripper forwards user authentication headers to the grafana-api server
// This ensures the short URL requests are authenticated as the original user
type shortURLUserAuthRoundTripper struct {
	originalRequest *http.Request
	transport       http.RoundTripper
	log             log.Logger
}

func (u *shortURLUserAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// Clone request properly (don't mutate the original)
	req = cloneRequest(req)

	// Always forward user authentication headers
	u.log.Debug("Forwarding user authentication headers to grafana-api", "url", req.URL.String())
	if u.originalRequest != nil {
		u.copyAuthHeaders(req)
	}

	// Chain to base transport
	resp, err := u.transport.RoundTrip(req)
	if err != nil {
		u.log.Error("HTTP request failed", "error", err, "url", req.URL.String())
		return nil, err
	}

	u.log.Debug("HTTP request completed", "status", resp.Status, "url", req.URL.String())
	return resp, nil
}

// copyAuthHeaders copies authentication-related headers from the original user request
func (u *shortURLUserAuthRoundTripper) copyAuthHeaders(req *http.Request) {
	// Forward standard authentication headers
	authHeaders := []string{"Cookie", "Authorization"}
	for _, header := range authHeaders {
		if value := u.originalRequest.Header.Get(header); value != "" {
			req.Header.Set(header, value)
		}
	}

	// Forward Grafana-specific headers (org context, etc.)
	for name, values := range u.originalRequest.Header {
		if strings.HasPrefix(name, "X-Grafana") {
			for _, value := range values {
				req.Header.Add(name, value)
			}
		}
	}
}

// cloneRequest creates a shallow clone of the HTTP request
func cloneRequest(req *http.Request) *http.Request {
	cloned := req.Clone(req.Context())
	if cloned.Header == nil {
		cloned.Header = make(http.Header)
	}
	// Copy headers
	for k, v := range req.Header {
		cloned.Header[k] = v
	}
	return cloned
}

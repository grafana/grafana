// Package tokenexchange serves the local token exchange that the plugins
// Grafana starts call to get access tokens for Grafana's API, for when no
// token signer is configured (see pluginauth.Config).
package tokenexchange

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"slices"
	"strings"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

// pluginGroupSuffix is the suffix of the API groups plugins serve.
const pluginGroupSuffix = ".ext.grafana.app"

// pluginGroupAudience is the audience the cloud API service for plugin groups
// accepts. Plugins request it to work there; locally Grafana serves those
// groups itself, so the audience grants nothing more.
const pluginGroupAudience = "apiextensions.k8s.io"

// maxRequestBytes bounds the request body, which holds at most a subject token.
const maxRequestBytes = 64 << 10

type Service struct {
	cfg *setting.Cfg
	log log.Logger
	// Restrict peers for loopback URLs. Explicit non-loopback endpoints still
	// require a process-specific access policy token.
	loopbackOnly bool
}

// ProvideService registers the token exchange at pluginauth.TokenExchangePath
// when Grafana signs plugin access tokens itself.
func ProvideService(cfg *setting.Cfg, pluginAuth *pluginauth.Config, rr routing.RouteRegister) *Service {
	s := &Service{
		cfg: cfg,
		log: log.New("plugins.tokenexchange"),
	}
	// Serve the exchange exactly when plugins are given its URL.
	if pluginAuth.LocalAPIURL() != "" {
		s.loopbackOnly = pluginAuth.LoopbackOnly
		// Callers authenticate with their access policy token, not as a Grafana
		// user, so the route is not behind sign-in.
		rr.Post(pluginauth.TokenExchangePath, routing.Wrap(s.signAccessToken))
	}
	return s
}

// exchangeResponse is the response of the auth API's sign-access-token
// endpoint, which authlib's token exchange client decodes.
type exchangeResponse struct {
	Status string        `json:"status"`
	Data   *exchangeData `json:"data,omitempty"`
	Error  string        `json:"error,omitempty"`
}

type exchangeData struct {
	Token string `json:"token"`
}

func errorResponse(status int, message string) response.Response {
	return response.JSON(status, exchangeResponse{Status: "error", Error: message})
}

func (s *Service) signAccessToken(c *contextmodel.ReqContext) response.Response {
	// The socket's peer address, not c.RemoteAddr(), which trusts forwarding headers.
	if s.loopbackOnly && !isLoopback(c.Req.RemoteAddr) {
		return errorResponse(http.StatusForbidden, "only available to plugin processes on this host")
	}
	bearer, ok := strings.CutPrefix(c.Req.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return errorResponse(http.StatusUnauthorized, "an access policy token is required")
	}
	// The token carries the manifests of the plugin process it was issued to.
	pluginID, manifest, ok := v3.LookupLocalAccessPolicyToken(bearer)
	if !ok {
		return errorResponse(http.StatusUnauthorized, "invalid access policy token")
	}

	var req authnlib.TokenExchangeRequest
	if err := json.NewDecoder(http.MaxBytesReader(c.Resp, c.Req.Body, maxRequestBytes)).Decode(&req); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid request body")
	}

	policy := policyFor(pluginID, s.cfg.ExtJWTAuth.Audiences, manifest)
	if req.Subject != nil {
		if err := configureSubjectSigning(&policy, s.cfg.PluginSettings[pluginID]); err != nil {
			s.log.Error("Invalid plugin subject signing configuration", "pluginId", pluginID, "error", err)
			return errorResponse(http.StatusInternalServerError, "invalid subject signing configuration")
		}
	}
	token, err := v3.SignLocalAccessToken(c.Req.Context(), policy, req)
	if err != nil {
		s.log.Warn("Refused to sign a plugin access token", "pluginId", pluginID, "error", err)
		if errors.Is(err, v3.ErrLocalAccessDenied) {
			return errorResponse(http.StatusForbidden, err.Error())
		}
		return errorResponse(http.StatusBadRequest, err.Error())
	}
	return response.JSON(http.StatusOK, exchangeResponse{Status: "success", Data: &exchangeData{Token: token}})
}

func isLoopback(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// policyFor returns what pluginID may sign, from its app manifest: everything
// in its own API group, and the access kinds it requests in extraPermissions,
// for Grafana's audiences and those groups.
//
// Tokens on behalf of a caller also delegate app access (plugins.app:access),
// which Grafana checks before serving any app plugin's API group. Delegated
// permissions only narrow the caller's own, so the caller's app access applies.
// The plugin's own tokens don't get it: unscoped, it would grant every app
// plugin's API. Grafana lets them into the groups their permissions name.
func policyFor(pluginID string, grafanaAudiences []string, manifest *app.ManifestData) v3.LocalAccessPolicy {
	policy := v3.LocalAccessPolicy{PluginID: pluginID}
	add := func(list *[]string, value string) {
		if value != "" && !slices.Contains(*list, value) {
			*list = append(*list, value)
		}
	}
	for _, audience := range grafanaAudiences {
		add(&policy.Audiences, audience)
	}
	if manifest == nil {
		return policy
	}
	policy.DelegatedPermissions = []string{pluginaccesscontrol.ActionAppAccess}
	if manifest.Group == "" {
		return policy
	}
	add(&policy.Audiences, manifest.Group)
	// Only a plugin group is the plugin's own. A manifest naming another group,
	// such as a core one, must request it as an access kind.
	if name, ok := strings.CutSuffix(manifest.Group, pluginGroupSuffix); ok && name != "" {
		add(&policy.Audiences, pluginGroupAudience) // apiextensions.k8s.io
		add(&policy.Permissions, manifest.Group+":*")
	}
	if manifest.ExtraPermissions != nil {
		for _, kind := range manifest.ExtraPermissions.AccessKinds {
			add(&policy.Audiences, kind.Group)
			for _, action := range kind.Actions {
				add(&policy.Permissions, fmt.Sprintf("%s/%s:%s", kind.Group, kind.Resource, action))
			}
		}
	}
	policy.DelegatedPermissions = append(policy.DelegatedPermissions, policy.Permissions...)
	return policy
}

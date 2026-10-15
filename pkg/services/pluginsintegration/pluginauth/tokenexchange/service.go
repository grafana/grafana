// Package tokenexchange serves the local token exchange that the plugins
// Grafana starts call to get access tokens for Grafana's API, for when no
// token signer is configured (see pluginauth.LocalTokens).
package tokenexchange

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

// maxRequestBytes bounds the request body, which holds at most a subject token.
const maxRequestBytes = 64 << 10

type Service struct {
	cfg *setting.Cfg
	log log.Logger
	// manifests returns the app manifests of a plugin.
	manifests func(ctx context.Context, pluginID string) ([]*app.ManifestData, error)
}

// ProvideService registers the token exchange at pluginauth.TokenExchangePath
// when Grafana signs plugin access tokens itself.
func ProvideService(cfg *setting.Cfg, rr routing.RouteRegister, pluginSources sources.Registry) *Service {
	s := &Service{
		cfg: cfg,
		log: log.New("plugins.tokenexchange"),
		manifests: func(ctx context.Context, pluginID string) ([]*app.ManifestData, error) {
			return loadManifests(ctx, pluginSources, pluginID)
		},
	}
	if pluginauth.LocalTokens(cfg) {
		// Callers authenticate with their access policy token, not as a Grafana
		// user, so the route is not behind sign-in.
		rr.Post(pluginauth.TokenExchangePath, routing.Wrap(s.signAccessToken))
	}
	return s
}

// exchangeResponse is the response of the auth API's sign-access-token
// endpoint, which authlib's token exchange client decodes.
type exchangeResponse struct {
	Status string `json:"status"`
	Data   *struct {
		Token string `json:"token"`
	} `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

func errorResponse(status int, message string) response.Response {
	return response.JSON(status, exchangeResponse{Status: "error", Error: message})
}

func (s *Service) signAccessToken(c *contextmodel.ReqContext) response.Response {
	bearer, ok := strings.CutPrefix(c.Req.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return errorResponse(http.StatusUnauthorized, "an access policy token is required")
	}
	pluginID, ok := v3.LocalAccessPolicyPluginID(bearer)
	if !ok {
		return errorResponse(http.StatusUnauthorized, "invalid access policy token")
	}

	var req authnlib.TokenExchangeRequest
	if err := json.NewDecoder(http.MaxBytesReader(c.Resp, c.Req.Body, maxRequestBytes)).Decode(&req); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid request body")
	}

	manifests, err := s.manifests(c.Req.Context(), pluginID)
	if err != nil {
		s.log.Error("Failed to load the plugin access policy", "pluginId", pluginID, "error", err)
		return errorResponse(http.StatusInternalServerError, "failed to load the plugin access policy")
	}

	policy := policyFor(pluginID, s.cfg.ExtJWTAuth.Audiences, manifests)
	token, err := v3.SignLocalAccessToken(c.Req.Context(), policy, req)
	if err != nil {
		s.log.Warn("Refused to sign a plugin access token", "pluginId", pluginID, "error", err)
		if errors.Is(err, v3.ErrLocalAccessDenied) {
			return errorResponse(http.StatusForbidden, err.Error())
		}
		return errorResponse(http.StatusBadRequest, err.Error())
	}
	rsp := exchangeResponse{Status: "success", Data: &struct {
		Token string `json:"token"`
	}{Token: token}}
	return response.JSON(http.StatusOK, rsp)
}

// loadManifests returns the app manifests of pluginID. They are read on each
// exchange, so a rebuilt plugin's manifest applies without restarting Grafana.
// Exchanges are infrequent, as clients cache tokens until they expire.
func loadManifests(ctx context.Context, pluginSources sources.Registry, pluginID string) ([]*app.ManifestData, error) {
	defs, err := definition.LoadPluginDefinition(ctx, pluginSources, definition.Options{
		Filter: func(j plugins.JSONData) bool {
			return j.ID == pluginID && j.Type == plugins.TypeApp
		},
		AppManifest: true,
	})
	if err != nil {
		return nil, err
	}
	var manifests []*app.ManifestData
	for _, def := range defs {
		manifests = append(manifests, def.Manifests...)
	}
	return manifests, nil
}

// policyFor returns what pluginID may sign, from its app manifests: everything
// in its own API groups, and the access kinds it requests in extraPermissions,
// for Grafana's audiences and those groups.
//
// It also grants app access (plugins.app:access), which Grafana checks before
// serving any app plugin's API group, the plugin's own included. On behalf of
// a caller, it only lets through the app access the caller has.
func policyFor(pluginID string, grafanaAudiences []string, manifests []*app.ManifestData) v3.LocalAccessPolicy {
	policy := v3.LocalAccessPolicy{PluginID: pluginID}
	add := func(list *[]string, value string) {
		if value != "" && !slices.Contains(*list, value) {
			*list = append(*list, value)
		}
	}
	for _, audience := range grafanaAudiences {
		add(&policy.Audiences, audience)
	}
	if len(manifests) == 0 {
		return policy
	}
	policy.Permissions = []string{pluginaccesscontrol.ActionAppAccess}
	for _, manifest := range manifests {
		if manifest == nil || manifest.Group == "" {
			continue
		}
		add(&policy.Audiences, manifest.Group)
		add(&policy.Permissions, manifest.Group+":*")
		if manifest.ExtraPermissions == nil {
			continue
		}
		for _, kind := range manifest.ExtraPermissions.AccessKinds {
			add(&policy.Audiences, kind.Group)
			for _, action := range kind.Actions {
				add(&policy.Permissions, fmt.Sprintf("%s/%s:%s", kind.Group, kind.Resource, action))
			}
		}
	}
	return policy
}

package sso

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// LoginConfigName is the singleton name for the pre-auth login-config read.
const LoginConfigName = "~"

// loginConfigPath is the route path for the login-config singleton.
const loginConfigPath = "ssosettings/" + LoginConfigName

// LoginConfigDTO is the flat, secret-free login configuration a pre-auth client
// needs to render the login form. Field names mirror dtos.FrontendSettingsDTO so
// the frontend can migrate to this endpoint without reshaping.
type LoginConfigDTO struct {
	DisableLoginForm  bool                          `json:"disableLoginForm"`
	DisableUserSignUp bool                          `json:"disableUserSignUp"`
	LoginHint         string                        `json:"loginHint"`
	PasswordHint      string                        `json:"passwordHint"`
	LdapEnabled       bool                          `json:"ldapEnabled"`
	OAuth             map[string]LoginOAuthProvider `json:"oauth"`
	SamlEnabled       bool                          `json:"samlEnabled"`
	SamlName          string                        `json:"samlName"`
}

// LoginOAuthProvider is the per-provider entry shown on the login form.
type LoginOAuthProvider struct {
	Name string `json:"name"`
	Icon string `json:"icon"`
}

// LoginConfigHandler serves the pre-auth login-config singleton. It reads the
// stack's SSO config through the given ssosettings service and the login-form
// settings through cfgProvider, both per request, and never emits secret fields.
type LoginConfigHandler struct {
	cfgProvider configprovider.ConfigProvider
	sso         ssosettings.Service
}

func NewLoginConfigHandler(cfgProvider configprovider.ConfigProvider, ssoSvc ssosettings.Service) *LoginConfigHandler {
	return &LoginConfigHandler{cfgProvider: cfgProvider, sso: ssoSvc}
}

func (h *LoginConfigHandler) GetAPIRoutes(_ map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path:    loginConfigPath,
				Spec:    h.routeSpec(),
				Handler: h.handle,
			},
		},
	}
}

func (h *LoginConfigHandler) handle(w http.ResponseWriter, req *http.Request) {
	dto, err := h.build(req.Context())
	if err != nil {
		errhttp.Write(req.Context(), err, w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(dto)
}

func (h *LoginConfigHandler) build(ctx context.Context) (LoginConfigDTO, error) {
	cfg, err := h.cfgProvider.Get(ctx)
	if err != nil {
		return LoginConfigDTO{}, fmt.Errorf("get config: %w", err)
	}

	settings, err := h.sso.List(ctx)
	if err != nil {
		return LoginConfigDTO{}, fmt.Errorf("list sso settings: %w", err)
	}

	dto := LoginConfigDTO{
		DisableLoginForm:  cfg.DisableLoginForm,
		DisableUserSignUp: !cfg.AllowUserSignUp,
		LoginHint:         cfg.LoginHint,
		PasswordHint:      cfg.PasswordHint,
		LdapEnabled:       cfg.LDAPAuthEnabled,
		OAuth:             map[string]LoginOAuthProvider{},
	}

	oauth := map[string]struct{}{}
	for _, p := range ssosettings.AllOAuthProviders {
		oauth[p] = struct{}{}
	}

	for _, s := range settings {
		st := s.Settings
		if !truthy(st["enabled"]) {
			continue
		}
		if s.Provider == social.SAMLProviderName {
			dto.SamlEnabled = true
			dto.SamlName, _ = st["name"].(string)
			continue
		}
		if _, ok := oauth[s.Provider]; !ok {
			continue // LDAP and anything non-OAuth are handled via cfg, not the oauth map.
		}
		name, _ := st["name"].(string)
		icon, _ := st["icon"].(string)
		dto.OAuth[s.Provider] = LoginOAuthProvider{Name: name, Icon: icon}
	}

	return dto, nil
}

// truthy coerces a settings value to a bool. MT-Settings stores every value as a
// string, so enabled arrives as "true"/"false"; legacy stores a real bool.
func truthy(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		b, _ := strconv.ParseBool(t)
		return b
	default:
		return false
	}
}

func (h *LoginConfigHandler) routeSpec() *spec3.PathProps {
	return &spec3.PathProps{
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				OperationId: "getSSOLoginConfig",
				Tags:        []string{"SSOSettings"},
				Description: "Public, unauthenticated login configuration for a stack (no secrets).",
				Parameters: []*spec3.Parameter{
					{
						ParameterProps: spec3.ParameterProps{
							Name:        "namespace",
							In:          "path",
							Required:    true,
							Example:     "default",
							Description: "workspace",
							Schema:      spec.StringProperty(),
						},
					},
				},
				Responses: &spec3.Responses{
					ResponsesProps: spec3.ResponsesProps{
						StatusCodeResponses: map[int]*spec3.Response{
							200: {
								ResponseProps: spec3.ResponseProps{
									Content: map[string]*spec3.MediaType{
										"application/json": {
											MediaTypeProps: spec3.MediaTypeProps{
												Schema: &spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

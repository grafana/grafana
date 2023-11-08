package social

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/jmespath/go-jmespath"
	"golang.org/x/oauth2"
	"gopkg.in/ini.v1"
)

var (
	errMissingGroupMembership = &Error{"user not a member of one of the required groups"}
)

type httpGetResponse struct {
	Body    []byte
	Headers http.Header
}

func (s *SocialBase) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialBase) IsSignupAllowed() bool {
	return s.allowSignup
}

func isEmailAllowed(email string, allowedDomains []string) bool {
	if len(allowedDomains) == 0 {
		return true
	}

	valid := false
	for _, domain := range allowedDomains {
		emailSuffix := fmt.Sprintf("@%s", domain)
		valid = valid || strings.HasSuffix(strings.ToLower(email), strings.ToLower(emailSuffix))
	}

	return valid
}

func (s *SocialBase) httpGet(ctx context.Context, client *http.Client, url string) (*httpGetResponse, error) {
	req, errReq := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if errReq != nil {
		return nil, errReq
	}

	r, errDo := client.Do(req)
	if errDo != nil {
		return nil, errDo
	}

	defer func() {
		if err := r.Body.Close(); err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, errRead := io.ReadAll(r.Body)
	if errRead != nil {
		return nil, errRead
	}

	response := &httpGetResponse{body, r.Header}

	if r.StatusCode >= 300 {
		return nil, fmt.Errorf("unsuccessful response status code %d: %s", r.StatusCode, string(response.Body))
	}

	s.log.Debug("HTTP GET", "url", url, "status", r.Status, "response_body", string(response.Body))

	return response, nil
}

func (s *SocialBase) searchJSONForAttr(attributePath string, data []byte) (any, error) {
	if attributePath == "" {
		return "", errors.New("no attribute path specified")
	}

	if len(data) == 0 {
		return "", errors.New("empty user info JSON response provided")
	}

	var buf any
	if err := json.Unmarshal(data, &buf); err != nil {
		return "", fmt.Errorf("%v: %w", "failed to unmarshal user info JSON response", err)
	}

	val, err := jmespath.Search(attributePath, buf)
	if err != nil {
		return "", fmt.Errorf("failed to search user info JSON response with provided path: %q: %w", attributePath, err)
	}

	return val, nil
}

func (s *SocialBase) searchJSONForStringAttr(attributePath string, data []byte) (string, error) {
	val, err := s.searchJSONForAttr(attributePath, data)
	if err != nil {
		return "", err
	}

	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}

	return "", nil
}

func (s *SocialBase) searchJSONForStringArrayAttr(attributePath string, data []byte) ([]string, error) {
	val, err := s.searchJSONForAttr(attributePath, data)
	if err != nil {
		return []string{}, err
	}

	ifArr, ok := val.([]any)
	if !ok {
		return []string{}, nil
	}

	result := []string{}
	for _, v := range ifArr {
		if strVal, ok := v.(string); ok {
			result = append(result, strVal)
		}
	}

	return result, nil
}

func createOAuthConfig(sec *ini.Section, info *OAuthInfo, cfg *setting.Cfg, defaultName string) *oauth2.Config {
	var authStyle oauth2.AuthStyle
	switch strings.ToLower(sec.Key("auth_style").String()) {
	case "inparams":
		authStyle = oauth2.AuthStyleInParams
	case "inheader":
		authStyle = oauth2.AuthStyleInHeader
	case "autodetect", "":
		authStyle = oauth2.AuthStyleAutoDetect
	default:
		// ss.log.Warn("Invalid auth style specified, defaulting to auth style AutoDetect", "auth_style", sec.KeyValue("auth_style").Value())
		authStyle = oauth2.AuthStyleAutoDetect
	}

	config := oauth2.Config{
		ClientID:     info.ClientId,
		ClientSecret: info.ClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:   info.AuthUrl,
			TokenURL:  info.TokenUrl,
			AuthStyle: authStyle,
		},
		RedirectURL: strings.TrimSuffix(cfg.AppURL, "/") + SocialBaseUrl + defaultName,
		Scopes:      info.Scopes,
	}

	return &config
}

func loadOAuthInfo(sec *ini.Section, name string) *OAuthInfo {
	info := &OAuthInfo{
		ClientId:                sec.Key("client_id").String(),
		ClientSecret:            sec.Key("client_secret").String(),
		Scopes:                  util.SplitString(sec.Key("scopes").String()),
		AuthUrl:                 sec.Key("auth_url").String(),
		TokenUrl:                sec.Key("token_url").String(),
		ApiUrl:                  sec.Key("api_url").String(),
		TeamsUrl:                sec.Key("teams_url").String(),
		Enabled:                 sec.Key("enabled").MustBool(),
		EmailAttributeName:      sec.Key("email_attribute_name").String(),
		EmailAttributePath:      sec.Key("email_attribute_path").String(),
		RoleAttributePath:       sec.Key("role_attribute_path").String(),
		RoleAttributeStrict:     sec.Key("role_attribute_strict").MustBool(),
		GroupsAttributePath:     sec.Key("groups_attribute_path").String(),
		TeamIdsAttributePath:    sec.Key("team_ids_attribute_path").String(),
		AllowedDomains:          util.SplitString(sec.Key("allowed_domains").String()),
		HostedDomain:            sec.Key("hosted_domain").String(),
		AllowSignup:             sec.Key("allow_sign_up").MustBool(),
		Name:                    sec.Key("name").MustString(name),
		Icon:                    sec.Key("icon").String(),
		TlsClientCert:           sec.Key("tls_client_cert").String(),
		TlsClientKey:            sec.Key("tls_client_key").String(),
		TlsClientCa:             sec.Key("tls_client_ca").String(),
		TlsSkipVerify:           sec.Key("tls_skip_verify_insecure").MustBool(),
		UsePKCE:                 sec.Key("use_pkce").MustBool(),
		UseRefreshToken:         sec.Key("use_refresh_token").MustBool(false),
		AllowAssignGrafanaAdmin: sec.Key("allow_assign_grafana_admin").MustBool(false),
		AutoLogin:               sec.Key("auto_login").MustBool(false),
		AllowedGroups:           util.SplitString(sec.Key("allowed_groups").String()),
	}

	// when empty_scopes parameter exists and is true, overwrite scope with empty value
	if sec.Key("empty_scopes").MustBool() {
		info.Scopes = []string{}
	}

	return info
}

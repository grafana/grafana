package connectors

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"slices"
	"strconv"
	"strings"

	"github.com/jmespath/go-jmespath"
	"github.com/mitchellh/mapstructure"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	// consider moving this to OAuthInfo
	teamIdsKey = "team_ids"
	// consider moving this to OAuthInfo
	allowedOrganizationsKey = "allowed_organizations"
)

var (
	errMissingGroupMembership = &SocialError{"user not a member of one of the required groups"}
)

type httpGetResponse struct {
	Body    []byte
	Headers http.Header
}

func (s *SocialBase) IsEmailAllowed(email string) bool {
	info := s.GetOAuthInfo()

	return isEmailAllowed(email, info.AllowedDomains)
}

func (s *SocialBase) IsSignupAllowed() bool {
	info := s.GetOAuthInfo()

	return info.AllowSignup
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

func createOAuthConfig(info *social.OAuthInfo, cfg *setting.Cfg, defaultName string) *oauth2.Config {
	var authStyle oauth2.AuthStyle
	switch strings.ToLower(info.AuthStyle) {
	case "inparams":
		authStyle = oauth2.AuthStyleInParams
	case "inheader":
		authStyle = oauth2.AuthStyleInHeader
	default:
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
		RedirectURL: strings.TrimSuffix(cfg.AppURL, "/") + social.SocialBaseUrl + defaultName,
		Scopes:      info.Scopes,
	}

	return &config
}

func MustBool(value any, defaultValue bool) bool {
	if value == nil {
		return defaultValue
	}

	str, ok := value.(string)
	if ok {
		result, err := strconv.ParseBool(str)
		if err != nil {
			return defaultValue
		}
		return result
	}

	result, ok := value.(bool)
	if !ok {
		return defaultValue
	}

	return result
}

// CreateOAuthInfoFromKeyValues creates an OAuthInfo struct from a map[string]any using mapstructure
// it puts all extra key values into OAuthInfo's Extra map
func CreateOAuthInfoFromKeyValues(settingsKV map[string]any) (*social.OAuthInfo, error) {
	emptyStrToSliceDecodeHook := func(from reflect.Type, to reflect.Type, data any) (any, error) {
		if from.Kind() == reflect.String && to.Kind() == reflect.Slice {
			strData, ok := data.(string)
			if !ok {
				return nil, fmt.Errorf("failed to convert %v to string", data)
			}

			if strData == "" {
				return []string{}, nil
			}
			return util.SplitString(strData), nil
		}
		return data, nil
	}

	var oauthInfo social.OAuthInfo
	decoder, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		DecodeHook:       emptyStrToSliceDecodeHook,
		Result:           &oauthInfo,
		WeaklyTypedInput: true,
	})

	if err != nil {
		return nil, err
	}

	err = decoder.Decode(settingsKV)
	if err != nil {
		return nil, err
	}

	if oauthInfo.EmptyScopes {
		oauthInfo.Scopes = []string{}
	}

	return &oauthInfo, err
}

func appendUniqueScope(config *oauth2.Config, scope string) {
	if !slices.Contains(config.Scopes, social.OfflineAccessScope) {
		config.Scopes = append(config.Scopes, social.OfflineAccessScope)
	}
}

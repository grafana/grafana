package social

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gogits/gogs/models"
	"github.com/golang/oauth2"
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

type BasicUserInfo struct {
	Identity string
	Name     string
	Email    string
	Login    string
	Company  string
}

type SocialConnector interface {
	Type() int
	UserInfo(transport *oauth2.Transport) (*BasicUserInfo, error)

	AuthCodeURL(state, accessType, prompt string) string
	NewTransportWithCode(code string) (*oauth2.Transport, error)
}

var (
	SocialBaseUrl = "/login"
	SocialMap     = make(map[string]SocialConnector)
)

func NewOauthService() {
	if !setting.Cfg.MustBool("oauth", "enabled") {
		return
	}

	var err error
	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)

	socialConfigs := make(map[string]*oauth2.Config)

	allOauthes := []string{"github", "google", "twitter"}

	// Load all OAuth config data.
	for _, name := range allOauthes {
		info := &setting.OAuthInfo{
			ClientId:     setting.Cfg.MustValue("oauth."+name, "client_id"),
			ClientSecret: setting.Cfg.MustValue("oauth."+name, "client_secrect"),
			Scopes:       setting.Cfg.MustValueArray("oauth."+name, "scopes", " "),
			AuthUrl:      setting.Cfg.MustValue("oauth."+name, "auth_url"),
			TokenUrl:     setting.Cfg.MustValue("oauth."+name, "token_url"),
		}

		opts := &oauth2.Options{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			RedirectURL:  strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
			Scopes:       info.Scopes,
		}

		setting.OAuthService.OAuthInfos[name] = info
		socialConfigs[name], err = oauth2.NewConfig(opts, info.AuthUrl, info.TokenUrl)
		if err != nil {
			log.Error(4, "Failed to init oauth service", err)
		}
	}

	enabledOauths := make([]string, 0, 10)

	// GitHub.
	if setting.Cfg.MustBool("oauth.github", "enabled") {
		setting.OAuthService.GitHub = true
		newGitHubOAuth(socialConfigs["github"])
		enabledOauths = append(enabledOauths, "GitHub")
	}

	// Google.
	if setting.Cfg.MustBool("oauth.google", "enabled") {
		setting.OAuthService.Google = true
		newGoogleOAuth(socialConfigs["google"])
		enabledOauths = append(enabledOauths, "Google")
	}
}

type SocialGithub struct {
	*oauth2.Config
}

func (s *SocialGithub) Type() int {
	return int(models.GITHUB)
}

func newGitHubOAuth(config *oauth2.Config) {
	SocialMap["github"] = &SocialGithub{
		Config: config,
	}
}

func (s *SocialGithub) UserInfo(transport *oauth2.Transport) (*BasicUserInfo, error) {
	var data struct {
		Id    int    `json:"id"`
		Name  string `json:"login"`
		Email string `json:"email"`
	}

	var err error
	client := http.Client{Transport: transport}
	r, err := client.Get("https://api.github.com/user")
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &BasicUserInfo{
		Identity: strconv.Itoa(data.Id),
		Name:     data.Name,
		Email:    data.Email,
	}, nil
}

//   ________                     .__
//  /  _____/  ____   ____   ____ |  |   ____
// /   \  ___ /  _ \ /  _ \ / ___\|  | _/ __ \
// \    \_\  (  <_> |  <_> ) /_/  >  |_\  ___/
//  \______  /\____/ \____/\___  /|____/\___  >
//         \/             /_____/           \/

type SocialGoogle struct {
	*oauth2.Config
}

func (s *SocialGoogle) Type() int {
	return int(models.GOOGLE)
}

func newGoogleOAuth(config *oauth2.Config) {
	SocialMap["google"] = &SocialGoogle{
		Config: config,
	}
}

func (s *SocialGoogle) UserInfo(transport *oauth2.Transport) (*BasicUserInfo, error) {
	var data struct {
		Id    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	var err error

	reqUrl := "https://www.googleapis.com/oauth2/v1/userinfo"
	client := http.Client{Transport: transport}
	r, err := client.Get(reqUrl)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}
	return &BasicUserInfo{
		Identity: data.Id,
		Name:     data.Name,
		Email:    data.Email,
	}, nil
}

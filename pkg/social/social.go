package social

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"

	"golang.org/x/oauth2"
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
	UserInfo(token *oauth2.Token) (*BasicUserInfo, error)

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx oauth2.Context, code string) (*oauth2.Token, error)
}

var (
	SocialBaseUrl = "/login/"
	SocialMap     = make(map[string]SocialConnector)
)

func NewOAuthService() {
	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)

	allOauthes := []string{"github", "google"}

	for _, name := range allOauthes {
		sec := setting.Cfg.Section("auth." + name)
		info := &setting.OAuthInfo{
			ClientId:     sec.Key("client_id").String(),
			ClientSecret: sec.Key("client_secret").String(),
			Scopes:       sec.Key("scopes").Strings(" "),
			AuthUrl:      sec.Key("auth_url").String(),
			TokenUrl:     sec.Key("token_url").String(),
			Enabled:      sec.Key("enabled").MustBool(),
		}

		if !info.Enabled {
			continue
		}

		setting.OAuthService.OAuthInfos[name] = info
		config := oauth2.Config{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:  info.AuthUrl,
				TokenURL: info.TokenUrl,
			},
			RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
			Scopes:      info.Scopes,
		}

		// GitHub.
		if name == "github" {
			setting.OAuthService.GitHub = true
			SocialMap["github"] = &SocialGithub{Config: &config}
		}

		// Google.
		if name == "google" {
			setting.OAuthService.Google = true
			SocialMap["google"] = &SocialGoogle{Config: &config}
		}
	}
}

type SocialGithub struct {
	*oauth2.Config
}

func (s *SocialGithub) Type() int {
	return int(models.GITHUB)
}

func (s *SocialGithub) UserInfo(token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id    int    `json:"id"`
		Name  string `json:"login"`
		Email string `json:"email"`
	}

	var err error
	client := s.Client(oauth2.NoContext, token)
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

func (s *SocialGoogle) UserInfo(token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	var err error

	reqUrl := "https://www.googleapis.com/oauth2/v1/userinfo"
	client := s.Client(oauth2.NoContext, token)
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

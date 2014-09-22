package api

import (
	"encoding/json"
	"net/http"

	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/golang/oauth2"
	"github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/stores"
)

var (
	githubOAuthConfig *oauth2.Config
	githubRedirectUrl string = "http://localhost:3000/oauth2/github/callback"
	githubAuthUrl     string = "https://github.com/login/oauth/authorize"
	githubTokenUrl    string = "https://github.com/login/oauth/access_token"
)

func init() {
	addRoutes(func(self *HttpServer) {
		if !self.cfg.Http.GithubOAuth.Enabled {
			return
		}

		self.router.GET("/oauth2/github", self.oauthGithub)
		self.router.GET("/oauth2/github/callback", self.oauthGithubCallback)

		options := &oauth2.Options{
			ClientID:     self.cfg.Http.GithubOAuth.ClientId,
			ClientSecret: self.cfg.Http.GithubOAuth.ClientSecret,
			RedirectURL:  githubRedirectUrl,
			Scopes:       []string{"user:email"},
		}

		cfg, err := oauth2.NewConfig(options, githubAuthUrl, githubTokenUrl)

		if err != nil {
			log.Error("Failed to init github auth %v", err)
		}

		githubOAuthConfig = cfg
	})
}

func (self *HttpServer) oauthGithub(c *gin.Context) {
	url := githubOAuthConfig.AuthCodeURL("", "online", "auto")
	c.Redirect(302, url)
}

type githubUserInfoDto struct {
	Login   string `json:"login"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Company string `json:"company"`
}

func (self *HttpServer) oauthGithubCallback(c *gin.Context) {
	code := c.Request.URL.Query()["code"][0]
	log.Info("OAuth code: %v", code)

	transport, err := githubOAuthConfig.NewTransportWithCode(code)
	if err != nil {
		c.String(500, "Failed to exchange oauth token: "+err.Error())
		return
	}

	client := http.Client{Transport: transport}
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		c.String(500, err.Error())
		return
	}

	var userInfo githubUserInfoDto
	decoder := json.NewDecoder(resp.Body)
	err = decoder.Decode(&userInfo)
	if err != nil {
		c.String(500, err.Error())
		return
	}

	if len(userInfo.Email) < 5 {
		c.String(500, "Invalid email")
		return
	}

	// try find existing account
	account, err := self.store.GetAccountByLogin(userInfo.Email)

	// create account if missing
	if err == stores.ErrAccountNotFound {
		account = &models.Account{
			Login:   userInfo.Login,
			Email:   userInfo.Email,
			Name:    userInfo.Name,
			Company: userInfo.Company,
		}

		if err = self.store.CreateAccount(account); err != nil {
			log.Error("Failed to create account %v", err)
			c.String(500, "Failed to create account")
			return
		}
	}

	// login
	loginUserWithAccount(account, c)

	c.Redirect(302, "/")
}

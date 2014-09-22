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
	googleOAuthConfig  *oauth2.Config
	googleRedirectUrl  string = "http://localhost:3000/oauth2/google/callback"
	googleAuthUrl      string = "https://accounts.google.com/o/oauth2/auth"
	googleTokenUrl     string = "https://accounts.google.com/o/oauth2/token"
	googleScopeProfile string = "https://www.googleapis.com/auth/userinfo.profile"
	googleScopeEmail   string = "https://www.googleapis.com/auth/userinfo.email"
)

func init() {
	addRoutes(func(self *HttpServer) {
		if !self.cfg.Http.GoogleOAuth.Enabled {
			return
		}

		self.router.GET("/oauth2/google", self.oauthGoogle)
		self.router.GET("/oauth2/google/callback", self.oauthGoogleCallback)

		options := &oauth2.Options{
			ClientID:     self.cfg.Http.GoogleOAuth.ClientId,
			ClientSecret: self.cfg.Http.GoogleOAuth.ClientSecret,
			RedirectURL:  googleRedirectUrl,
			Scopes:       []string{googleScopeEmail, googleScopeProfile},
		}

		cfg, err := oauth2.NewConfig(options, googleAuthUrl, googleTokenUrl)

		if err != nil {
			log.Error("Failed to init google auth %v", err)
		}

		googleOAuthConfig = cfg
	})
}

func (self *HttpServer) oauthGoogle(c *gin.Context) {
	url := googleOAuthConfig.AuthCodeURL("", "online", "auto")
	c.Redirect(302, url)
}

type googleUserInfoDto struct {
	Email      string `json:"email"`
	GivenName  string `json:"givenName"`
	FamilyName string `json:"familyName"`
	Name       string `json:"name"`
}

func (self *HttpServer) oauthGoogleCallback(c *gin.Context) {
	code := c.Request.URL.Query()["code"][0]
	log.Info("OAuth code: %v", code)

	transport, err := googleOAuthConfig.NewTransportWithCode(code)
	if err != nil {
		c.String(500, "Failed to exchange oauth token: "+err.Error())
		return
	}

	client := http.Client{Transport: transport}
	resp, err := client.Get("https://www.googleapis.com/oauth2/v1/userinfo?alt=json")
	if err != nil {
		c.String(500, err.Error())
		return
	}

	var userInfo googleUserInfoDto
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
			Login: userInfo.Email,
			Email: userInfo.Email,
			Name:  userInfo.Name,
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

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

var oauthCfg *oauth2.Config

func init() {
	addRoutes(func(self *HttpServer) {
		if !self.cfg.Http.GoogleOAuth.Enabled {
			return
		}

		self.router.GET("/login/google", self.loginGoogle)
		self.router.GET("/oauth2callback", self.oauthCallback)

		options := &oauth2.Options{
			ClientID:     self.cfg.Http.GoogleOAuth.ClientId,
			ClientSecret: self.cfg.Http.GoogleOAuth.ClientSecret,
			RedirectURL:  "http://localhost:3000/oauth2callback",
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.profile",
				"https://www.googleapis.com/auth/userinfo.email",
			},
		}

		cfg, err := oauth2.NewConfig(options,
			"https://accounts.google.com/o/oauth2/auth",
			"https://accounts.google.com/o/oauth2/token")

		if err != nil {
			log.Error("Failed to init google auth %v", err)
		}

		oauthCfg = cfg
	})
}

func (self *HttpServer) loginGoogle(c *gin.Context) {
	url := oauthCfg.AuthCodeURL("", "online", "auto")
	c.Redirect(302, url)
}

type googleUserInfoDto struct {
	Email      string `json:"email"`
	GivenName  string `json:"givenName"`
	FamilyName string `json:"familyName"`
	Name       string `json:"name"`
}

func (self *HttpServer) oauthCallback(c *gin.Context) {
	code := c.Request.URL.Query()["code"][0]
	log.Info("OAuth code: %v", code)

	transport, err := oauthCfg.NewTransportWithCode(code)
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

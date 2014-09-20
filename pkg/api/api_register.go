package api

import (
	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/register/*_", self.index)
		self.router.POST("/api/register/user", self.registerUserPost)
	})
}

type registerAccountJsonModel struct {
	Email     string `json:"email" binding:"required"`
	Password  string `json:"password" binding:"required"`
	Password2 bool   `json:"remember2"`
}

func (self *HttpServer) registerUserPost(c *gin.Context) {
	var registerModel registerAccountJsonModel

	if !c.EnsureBody(&registerModel) {
		c.JSON(400, gin.H{"status": "bad request"})
		return
	}

	account := models.Account{
		UserName: registerModel.Email,
		Login:    registerModel.Email,
		Email:    registerModel.Email,
		Password: registerModel.Password,
	}

	err := self.store.CreateAccount(&account)
	if err != nil {
		log.Error("Failed to create user account, email: %v, error: %v", registerModel.Email, err)
		c.JSON(500, gin.H{"status": "failed to create account"})
		return
	}

	c.JSON(200, gin.H{"status": "ok"})
}

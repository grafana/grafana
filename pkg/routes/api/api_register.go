package api

import (
	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

type registerAccountJsonModel struct {
	Email     string `json:"email" binding:"required"`
	Password  string `json:"password" binding:"required"`
	Password2 bool   `json:"remember2"`
}

func CreateAccount(c *middleware.Context) {
	var registerModel registerAccountJsonModel

	if !c.JsonBody(&registerModel) {
		c.JSON(400, utils.DynMap{"status": "bad request"})
		return
	}

	account := models.Account{
		Login:    registerModel.Email,
		Email:    registerModel.Email,
		Password: registerModel.Password,
	}

	err := models.CreateAccount(&account)
	if err != nil {
		log.Error(2, "Failed to create user account, email: %v, error: %v", registerModel.Email, err)
		c.JSON(500, utils.DynMap{"status": "failed to create account"})
		return
	}

	c.JSON(200, utils.DynMap{"status": "ok"})
}

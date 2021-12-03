package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var helloMessage = util.DynMap{
	"chat_id":      1,
	"user_id":      1,
	"message_type": 0,
	"text":         "Hello cha-cha-chat",
}

var byeMessage = util.DynMap{
	"chat_id":      1,
	"user_id":      2,
	"message_type": 0,
	"text":         "Bye cha-cha-chat",
}

func GetMessages(c *models.ReqContext) response.Response {
	messages := [2]util.DynMap{helloMessage, byeMessage}
	r := util.DynMap{
		"messages": messages,
	}
	return response.JSON(200, r)
}

func SendMessage(c *models.ReqContext) response.Response {
	return response.JSON(200, helloMessage)
}

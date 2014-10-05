package apimodel

import (
	"crypto/md5"
	"fmt"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/models"
)

type LoginResultDto struct {
	Status string         `json:"status"`
	User   CurrentUserDto `json:"user"`
}

type CurrentUserDto struct {
	Login       string `json:"login"`
	Email       string `json:"email"`
	GravatarUrl string `json:"gravatarUrl"`
}

func NewCurrentUserDto(account *models.Account) *CurrentUserDto {
	model := &CurrentUserDto{}
	if account != nil {
		model.Login = account.Login
		model.Email = account.Email
		model.GravatarUrl = getGravatarUrl(account.Email)
	}
	return model
}

func getGravatarUrl(text string) string {
	hasher := md5.New()
	hasher.Write([]byte(strings.ToLower(text)))
	return fmt.Sprintf("https://secure.gravatar.com/avatar/%x?s=90&default=mm", hasher.Sum(nil))
}

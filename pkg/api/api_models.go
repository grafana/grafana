package api

import (
	"crypto/md5"
	"fmt"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/models"
)

type saveDashboardCommand struct {
	Id        string `json:"id"`
	Title     string `json:"title"`
	Dashboard map[string]interface{}
}

type errorResponse struct {
	Message string `json:"message"`
}

type IndexDto struct {
	User CurrentUserDto
}

type CurrentUserDto struct {
	Login       string `json:"login"`
	Email       string `json:"email"`
	GravatarUrl string `json:"gravatarUrl"`
}

type LoginResultDto struct {
	Status string         `json:"status"`
	User   CurrentUserDto `json:"user"`
}

func newErrorResponse(message string) *errorResponse {
	return &errorResponse{Message: message}
}

func initCurrentUserDto(userDto *CurrentUserDto, account *models.Account) {
	if account != nil {
		userDto.Login = account.Login
		userDto.Email = account.Email
		userDto.GravatarUrl = getGravatarUrl(account.Email)
	}
}

func getGravatarUrl(text string) string {
	hasher := md5.New()
	hasher.Write([]byte(strings.ToLower(text)))
	return fmt.Sprintf("https://secure.gravatar.com/avatar/%x?s=90&default=mm", hasher.Sum(nil))
}

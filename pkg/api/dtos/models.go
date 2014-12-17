package dtos

import (
	"crypto/md5"
	"fmt"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/models"
)

type LoginResult struct {
	Status string      `json:"status"`
	User   CurrentUser `json:"user"`
}

type CurrentUser struct {
	Login       string `json:"login"`
	Email       string `json:"email"`
	GravatarUrl string `json:"gravatarUrl"`
}

type AccountInfo struct {
	Email         string          `json:"email"`
	Name          string          `json:"name"`
	Collaborators []*Collaborator `json:"collaborators"`
}

type OtherAccount struct {
	Id      int64  `json:"id"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	IsUsing bool   `json:"isUsing"`
}

type Collaborator struct {
	AccountId int64  `json:"accountId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
}

type DataSource struct {
	Id        int64 `json:"id"`
	AccountId int64 `json:"accountId"`

	Name      string          `json:"name"`
	Type      models.DsType   `json:"type"`
	Access    models.DsAccess `json:"access"`
	Url       string          `json:"url"`
	Password  string          `json:"password"`
	User      string          `json:"user"`
	BasicAuth bool            `json:"basicAuth"`
}

func NewCurrentUser(account *models.Account) *CurrentUser {
	model := &CurrentUser{}
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

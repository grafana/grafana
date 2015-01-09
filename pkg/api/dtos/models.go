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

type DataSource struct {
	Id        int64           `json:"id"`
	AccountId int64           `json:"accountId"`
	Name      string          `json:"name"`
	Type      models.DsType   `json:"type"`
	Access    models.DsAccess `json:"access"`
	Url       string          `json:"url"`
	Password  string          `json:"password"`
	User      string          `json:"user"`
	Database  string          `json:"database"`
	BasicAuth bool            `json:"basicAuth"`
	IsDefault bool            `json:"isDefault"`
}

type MetricQueryResultDto struct {
	Data []MetricQueryResultDataDto `json:"data"`
}

type MetricQueryResultDataDto struct {
	Target     string       `json:"target"`
	DataPoints [][2]float64 `json:"datapoints"`
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

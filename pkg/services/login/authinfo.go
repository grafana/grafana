package login

import "github.com/grafana/grafana/pkg/models"

type AuthInfoService interface {
	LookupAndUpdate(query *models.GetUserByAuthInfoQuery) (*models.User, error)
}

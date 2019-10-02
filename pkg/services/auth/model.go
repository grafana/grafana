package auth

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type userAuthToken struct {
	Id            int64
	UserId        int64
	AuthToken     string
	PrevAuthToken string
	UserAgent     string
	ClientIp      string
	AuthTokenSeen bool
	SeenAt        int64
	RotatedAt     int64
	CreatedAt     int64
	UpdatedAt     int64
	UnhashedToken string `xorm:"-"`
}

func userAuthTokenFromUserToken(ut *models.UserToken) *userAuthToken {
	var uat userAuthToken
	uat.fromUserToken(ut)
	return &uat
}

func (uat *userAuthToken) fromUserToken(ut *models.UserToken) error {
	if uat == nil {
		return fmt.Errorf("needs pointer to userAuthToken struct")
	}

	uat.Id = ut.Id
	uat.UserId = ut.UserId
	uat.AuthToken = ut.AuthToken
	uat.PrevAuthToken = ut.PrevAuthToken
	uat.UserAgent = ut.UserAgent
	uat.ClientIp = ut.ClientIp
	uat.AuthTokenSeen = ut.AuthTokenSeen
	uat.SeenAt = ut.SeenAt
	uat.RotatedAt = ut.RotatedAt
	uat.CreatedAt = ut.CreatedAt
	uat.UpdatedAt = ut.UpdatedAt
	uat.UnhashedToken = ut.UnhashedToken

	return nil
}

func (uat *userAuthToken) toUserToken(ut *models.UserToken) error {
	if uat == nil {
		return fmt.Errorf("needs pointer to userAuthToken struct")
	}

	ut.Id = uat.Id
	ut.UserId = uat.UserId
	ut.AuthToken = uat.AuthToken
	ut.PrevAuthToken = uat.PrevAuthToken
	ut.UserAgent = uat.UserAgent
	ut.ClientIp = uat.ClientIp
	ut.AuthTokenSeen = uat.AuthTokenSeen
	ut.SeenAt = uat.SeenAt
	ut.RotatedAt = uat.RotatedAt
	ut.CreatedAt = uat.CreatedAt
	ut.UpdatedAt = uat.UpdatedAt
	ut.UnhashedToken = uat.UnhashedToken

	return nil
}

package authimpl

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/auth"
)

type userAuthToken struct {
	Id                int64
	UserId            int64
	AuthToken         string
	UserAgent         string
	ClientIp          string
	SeenAt            int64
	CreatedAt         int64
	UpdatedAt         int64
	RevokedAt         int64
	UnhashedToken     string `xorm:"-"`
	ExternalSessionId int64
}

func userAuthTokenFromUserToken(ut *auth.UserToken) (*userAuthToken, error) {
	var uat userAuthToken
	err := uat.fromUserToken(ut)
	return &uat, err
}

func (uat *userAuthToken) fromUserToken(ut *auth.UserToken) error {
	if uat == nil {
		return fmt.Errorf("needs pointer to userAuthToken struct")
	}

	uat.Id = ut.Id
	uat.UserId = ut.UserId
	uat.AuthToken = ut.AuthToken
	uat.UserAgent = ut.UserAgent
	uat.ClientIp = ut.ClientIp
	uat.SeenAt = ut.SeenAt
	uat.CreatedAt = ut.CreatedAt
	uat.UpdatedAt = ut.UpdatedAt
	uat.RevokedAt = ut.RevokedAt
	uat.UnhashedToken = ut.UnhashedToken
	uat.ExternalSessionId = ut.ExternalSessionId

	return nil
}

func (uat *userAuthToken) toUserToken(ut *auth.UserToken) error {
	if uat == nil {
		return fmt.Errorf("needs pointer to userAuthToken struct")
	}

	ut.Id = uat.Id
	ut.UserId = uat.UserId
	ut.AuthToken = uat.AuthToken
	ut.UserAgent = uat.UserAgent
	ut.ClientIp = uat.ClientIp
	ut.SeenAt = uat.SeenAt
	ut.CreatedAt = uat.CreatedAt
	ut.UpdatedAt = uat.UpdatedAt
	ut.RevokedAt = uat.RevokedAt
	ut.UnhashedToken = uat.UnhashedToken
	ut.ExternalSessionId = uat.ExternalSessionId
	return nil
}

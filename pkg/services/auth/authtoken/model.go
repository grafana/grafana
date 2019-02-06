package authtoken

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/auth"
)

// Typed errors
var (
	ErrAuthTokenNotFound = errors.New("user auth token not found")
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

func userAuthTokenFromUserToken(ut *auth.UserToken) *userAuthToken {
	var uat userAuthToken
	uat.fromUserToken(ut)
	return &uat
}

func (uat *userAuthToken) fromUserToken(ut *auth.UserToken) {
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
}

func (uat *userAuthToken) toUserToken(ut *auth.UserToken) error {
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

// UserAuthTokenService are used for generating and validating user auth tokens
type UserAuthTokenService interface {
	CreateToken(userId int64, clientIP, userAgent string) (*auth.UserToken, error)
	LookupToken(unhashedToken string) (*auth.UserToken, error)
	TryRotateToken(token *auth.UserToken, clientIP, userAgent string) (bool, error)
	RevokeToken(token *auth.UserToken) error
}

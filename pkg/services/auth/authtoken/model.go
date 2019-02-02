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

func (uat *userAuthToken) toUserToken() (auth.UserToken, error) {
	if uat == nil {
		return nil, fmt.Errorf("needs pointer to userAuthToken struct")
	}

	return &userTokenImpl{
		userAuthToken: uat,
	}, nil
}

type userToken interface {
	auth.UserToken
	GetModel() *userAuthToken
}

type userTokenImpl struct {
	*userAuthToken
}

func (ut *userTokenImpl) GetUserId() int64 {
	return ut.UserId
}

func (ut *userTokenImpl) GetToken() string {
	return ut.UnhashedToken
}

func (ut *userTokenImpl) GetModel() *userAuthToken {
	return ut.userAuthToken
}

func extractModelFromToken(token auth.UserToken) (*userAuthToken, error) {
	ut, ok := token.(userToken)
	if !ok {
		return nil, fmt.Errorf("failed to cast token")
	}

	return ut.GetModel(), nil
}

// UserAuthTokenService are used for generating and validating user auth tokens
type UserAuthTokenService interface {
	CreateToken(userId int64, clientIP, userAgent string) (auth.UserToken, error)
	LookupToken(unhashedToken string) (auth.UserToken, error)
	TryRotateToken(token auth.UserToken, clientIP, userAgent string) (bool, error)
	RevokeToken(token auth.UserToken) error
}

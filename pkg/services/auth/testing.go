package auth

import "github.com/grafana/grafana/pkg/models"

type FakeUserAuthTokenService struct {
	CreateTokenProvider         func(userId int64, clientIP, userAgent string) (*models.UserToken, error)
	TryRotateTokenProvider      func(token *models.UserToken, clientIP, userAgent string) (bool, error)
	LookupTokenProvider         func(unhashedToken string) (*models.UserToken, error)
	RevokeTokenProvider         func(token *models.UserToken) error
	RevokeAllUserTokensProvider func(userId int64) error
	ActiveAuthTokenCount        func() (int64, error)
	GetUserTokenProvider        func(userId, userTokenId int64) (*models.UserToken, error)
	GetUserTokensProvider       func(userId int64) ([]*models.UserToken, error)
}

func NewFakeUserAuthTokenService() *FakeUserAuthTokenService {
	return &FakeUserAuthTokenService{
		CreateTokenProvider: func(userId int64, clientIP, userAgent string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        0,
				UnhashedToken: "",
			}, nil
		},
		TryRotateTokenProvider: func(token *models.UserToken, clientIP, userAgent string) (bool, error) {
			return false, nil
		},
		LookupTokenProvider: func(unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        0,
				UnhashedToken: "",
			}, nil
		},
		RevokeTokenProvider: func(token *models.UserToken) error {
			return nil
		},
		RevokeAllUserTokensProvider: func(userId int64) error {
			return nil
		},
		ActiveAuthTokenCount: func() (int64, error) {
			return 10, nil
		},
		GetUserTokenProvider: func(userId, userTokenId int64) (*models.UserToken, error) {
			return nil, nil
		},
		GetUserTokensProvider: func(userId int64) ([]*models.UserToken, error) {
			return nil, nil
		},
	}
}

func (s *FakeUserAuthTokenService) CreateToken(userId int64, clientIP, userAgent string) (*models.UserToken, error) {
	return s.CreateTokenProvider(userId, clientIP, userAgent)
}

func (s *FakeUserAuthTokenService) LookupToken(unhashedToken string) (*models.UserToken, error) {
	return s.LookupTokenProvider(unhashedToken)
}

func (s *FakeUserAuthTokenService) TryRotateToken(token *models.UserToken, clientIP, userAgent string) (bool, error) {
	return s.TryRotateTokenProvider(token, clientIP, userAgent)
}

func (s *FakeUserAuthTokenService) RevokeToken(token *models.UserToken) error {
	return s.RevokeTokenProvider(token)
}

func (s *FakeUserAuthTokenService) RevokeAllUserTokens(userId int64) error {
	return s.RevokeAllUserTokensProvider(userId)
}

func (s *FakeUserAuthTokenService) ActiveTokenCount() (int64, error) {
	return s.ActiveAuthTokenCount()
}

func (s *FakeUserAuthTokenService) GetUserToken(userId, userTokenId int64) (*models.UserToken, error) {
	return s.GetUserTokenProvider(userId, userTokenId)
}

func (s *FakeUserAuthTokenService) GetUserTokens(userId int64) ([]*models.UserToken, error) {
	return s.GetUserTokensProvider(userId)
}

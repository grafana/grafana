package auth

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeUserAuthTokenService struct {
	CreateTokenProvider         func(ctx context.Context, userId int64, clientIP, userAgent string) (*models.UserToken, error)
	TryRotateTokenProvider      func(ctx context.Context, token *models.UserToken, clientIP, userAgent string) (bool, error)
	LookupTokenProvider         func(ctx context.Context, unhashedToken string) (*models.UserToken, error)
	RevokeTokenProvider         func(ctx context.Context, token *models.UserToken) error
	RevokeAllUserTokensProvider func(ctx context.Context, userId int64) error
	ActiveAuthTokenCount        func(ctx context.Context) (int64, error)
	GetUserTokenProvider        func(ctx context.Context, userId, userTokenId int64) (*models.UserToken, error)
	GetUserTokensProvider       func(ctx context.Context, userId int64) ([]*models.UserToken, error)
}

func NewFakeUserAuthTokenService() *FakeUserAuthTokenService {
	return &FakeUserAuthTokenService{
		CreateTokenProvider: func(ctx context.Context, userId int64, clientIP, userAgent string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        0,
				UnhashedToken: "",
			}, nil
		},
		TryRotateTokenProvider: func(ctx context.Context, token *models.UserToken, clientIP, userAgent string) (bool, error) {
			return false, nil
		},
		LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        0,
				UnhashedToken: "",
			}, nil
		},
		RevokeTokenProvider: func(ctx context.Context, token *models.UserToken) error {
			return nil
		},
		RevokeAllUserTokensProvider: func(ctx context.Context, userId int64) error {
			return nil
		},
		ActiveAuthTokenCount: func(ctx context.Context) (int64, error) {
			return 10, nil
		},
		GetUserTokenProvider: func(ctx context.Context, userId, userTokenId int64) (*models.UserToken, error) {
			return nil, nil
		},
		GetUserTokensProvider: func(ctx context.Context, userId int64) ([]*models.UserToken, error) {
			return nil, nil
		},
	}
}

func (s *FakeUserAuthTokenService) CreateToken(ctx context.Context, userId int64, clientIP, userAgent string) (*models.UserToken, error) {
	return s.CreateTokenProvider(context.Background(), userId, clientIP, userAgent)
}

func (s *FakeUserAuthTokenService) LookupToken(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
	return s.LookupTokenProvider(context.Background(), unhashedToken)
}

func (s *FakeUserAuthTokenService) TryRotateToken(ctx context.Context, token *models.UserToken, clientIP, userAgent string) (bool, error) {
	return s.TryRotateTokenProvider(context.Background(), token, clientIP, userAgent)
}

func (s *FakeUserAuthTokenService) RevokeToken(ctx context.Context, token *models.UserToken) error {
	return s.RevokeTokenProvider(context.Background(), token)
}

func (s *FakeUserAuthTokenService) RevokeAllUserTokens(ctx context.Context, userId int64) error {
	return s.RevokeAllUserTokensProvider(context.Background(), userId)
}

func (s *FakeUserAuthTokenService) ActiveTokenCount(ctx context.Context) (int64, error) {
	return s.ActiveAuthTokenCount(context.Background())
}

func (s *FakeUserAuthTokenService) GetUserToken(ctx context.Context, userId, userTokenId int64) (*models.UserToken, error) {
	return s.GetUserTokenProvider(context.Background(), userId, userTokenId)
}

func (s *FakeUserAuthTokenService) GetUserTokens(ctx context.Context, userId int64) ([]*models.UserToken, error) {
	return s.GetUserTokensProvider(context.Background(), userId)
}

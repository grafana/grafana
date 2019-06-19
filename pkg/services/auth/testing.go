package auth

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func CreateTestContext(t *testing.T) *testContext {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)
	tokenService := &UserAuthTokenService{
		SQLStore: sqlstore,
		Cfg: &setting.Cfg{
			LoginMaxInactiveLifetimeDays: 7,
			LoginMaxLifetimeDays:         30,
			TokenRotationIntervalMinutes: 10,
		},
		log: log.New("test-logger"),
	}

	return &testContext{
		SQLstore:     sqlstore,
		TokenService: tokenService,
	}
}

type testContext struct {
	SQLstore     *sqlstore.SqlStore
	TokenService *UserAuthTokenService
}

func (c *testContext) getAuthTokenByID(id int64) (*userAuthToken, error) {
	sess := c.SQLstore.NewSession()
	var t userAuthToken
	found, err := sess.ID(id).Get(&t)
	if err != nil || !found {
		return nil, err
	}

	return &t, nil
}

func (c *testContext) markAuthTokenAsSeen(id int64) (bool, error) {
	sess := c.SQLstore.NewSession()
	res, err := sess.Exec("UPDATE user_auth_token SET auth_token_seen = ? WHERE id = ?", c.SQLstore.Dialect.BooleanStr(true), id)
	if err != nil {
		return false, err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected == 1, nil
}

func (c *testContext) updateRotatedAt(id, rotatedAt int64) (bool, error) {
	sess := c.SQLstore.NewSession()
	res, err := sess.Exec("UPDATE user_auth_token SET rotated_at = ? WHERE id = ?", rotatedAt, id)
	if err != nil {
		return false, err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected == 1, nil
}

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

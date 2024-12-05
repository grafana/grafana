package authtest

import (
	"context"
	"errors"
	"net"
	"time"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
)

var _ auth.UserTokenService = (*FakeUserAuthTokenService)(nil)

type FakeUserAuthTokenService struct {
	CreateTokenProvider                 func(ctx context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error)
	RotateTokenProvider                 func(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error)
	GetTokenByExternalSessionIDProvider func(ctx context.Context, externalSessionID int64) (*auth.UserToken, error)
	GetExternalSessionProvider          func(ctx context.Context, externalSessionID int64) (*auth.ExternalSession, error)
	FindExternalSessionsProvider        func(ctx context.Context, query *auth.ListExternalSessionQuery) ([]*auth.ExternalSession, error)
	UpdateExternalSessionProvider       func(ctx context.Context, externalSessionID int64, cmd *auth.UpdateExternalSessionCommand) error
	TryRotateTokenProvider              func(ctx context.Context, token *auth.UserToken, clientIP net.IP, userAgent string) (bool, *auth.UserToken, error)
	LookupTokenProvider                 func(ctx context.Context, unhashedToken string) (*auth.UserToken, error)
	RevokeTokenProvider                 func(ctx context.Context, token *auth.UserToken, soft bool) error
	RevokeAllUserTokensProvider         func(ctx context.Context, userID int64) error
	ActiveTokenCountProvider            func(ctx context.Context, userID *int64) (int64, error)
	GetUserTokenProvider                func(ctx context.Context, userID, userTokenID int64) (*auth.UserToken, error)
	GetUserTokensProvider               func(ctx context.Context, userID int64) ([]*auth.UserToken, error)
	GetUserRevokedTokensProvider        func(ctx context.Context, userID int64) ([]*auth.UserToken, error)
	BatchRevokedTokenProvider           func(ctx context.Context, userIDs []int64) error
}

func NewFakeUserAuthTokenService() *FakeUserAuthTokenService {
	return &FakeUserAuthTokenService{
		CreateTokenProvider: func(ctx context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        0,
				UnhashedToken: "",
			}, nil
		},
		TryRotateTokenProvider: func(ctx context.Context, token *auth.UserToken, clientIP net.IP, userAgent string) (bool, *auth.UserToken, error) {
			return false, nil, nil
		},
		LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        0,
				UnhashedToken: "",
			}, nil
		},
		RevokeTokenProvider: func(ctx context.Context, token *auth.UserToken, soft bool) error {
			return nil
		},
		RevokeAllUserTokensProvider: func(ctx context.Context, userId int64) error {
			return nil
		},
		BatchRevokedTokenProvider: func(ctx context.Context, userIds []int64) error {
			return nil
		},
		ActiveTokenCountProvider: func(ctx context.Context, userID *int64) (int64, error) {
			return 10, nil
		},
		GetUserTokenProvider: func(ctx context.Context, userId, userTokenId int64) (*auth.UserToken, error) {
			return nil, nil
		},
		GetUserTokensProvider: func(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
			return nil, nil
		},
		GetExternalSessionProvider: func(ctx context.Context, externalSessionID int64) (*auth.ExternalSession, error) {
			return nil, errors.New("settings Provider table not found")
		},
	}
}

// Init initializes the service.
// Required for dependency injection.
func (s *FakeUserAuthTokenService) Init() error {
	return nil
}

func (s *FakeUserAuthTokenService) CreateToken(ctx context.Context, cmd *auth.CreateTokenCommand) (*auth.UserToken, error) {
	return s.CreateTokenProvider(context.Background(), cmd)
}

func (s *FakeUserAuthTokenService) RotateToken(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error) {
	return s.RotateTokenProvider(ctx, cmd)
}

func (s *FakeUserAuthTokenService) GetTokenByExternalSessionID(ctx context.Context, externalSessionID int64) (*auth.UserToken, error) {
	return s.GetTokenByExternalSessionIDProvider(ctx, externalSessionID)
}

func (s *FakeUserAuthTokenService) GetExternalSession(ctx context.Context, externalSessionID int64) (*auth.ExternalSession, error) {
	return s.GetExternalSessionProvider(ctx, externalSessionID)
}

func (s *FakeUserAuthTokenService) FindExternalSessions(ctx context.Context, query *auth.ListExternalSessionQuery) ([]*auth.ExternalSession, error) {
	return s.FindExternalSessionsProvider(context.Background(), query)
}

func (s *FakeUserAuthTokenService) UpdateExternalSession(ctx context.Context, externalSessionID int64, cmd *auth.UpdateExternalSessionCommand) error {
	return s.UpdateExternalSessionProvider(context.Background(), externalSessionID, cmd)
}

func (s *FakeUserAuthTokenService) LookupToken(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
	return s.LookupTokenProvider(context.Background(), unhashedToken)
}

func (s *FakeUserAuthTokenService) RevokeToken(ctx context.Context, token *auth.UserToken, soft bool) error {
	return s.RevokeTokenProvider(context.Background(), token, soft)
}

func (s *FakeUserAuthTokenService) RevokeAllUserTokens(ctx context.Context, userId int64) error {
	return s.RevokeAllUserTokensProvider(context.Background(), userId)
}

func (s *FakeUserAuthTokenService) ActiveTokenCount(ctx context.Context, userID *int64) (int64, error) {
	return s.ActiveTokenCountProvider(context.Background(), userID)
}

func (s *FakeUserAuthTokenService) GetUserToken(ctx context.Context, userId, userTokenId int64) (*auth.UserToken, error) {
	return s.GetUserTokenProvider(context.Background(), userId, userTokenId)
}

func (s *FakeUserAuthTokenService) GetUserTokens(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
	return s.GetUserTokensProvider(context.Background(), userId)
}

func (s *FakeUserAuthTokenService) GetUserRevokedTokens(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
	return s.GetUserRevokedTokensProvider(context.Background(), userId)
}

func (s *FakeUserAuthTokenService) BatchRevokeAllUserTokens(ctx context.Context, userIds []int64) error {
	return s.BatchRevokedTokenProvider(ctx, userIds)
}

type FakeOAuthTokenService struct {
	passThruEnabled  bool
	ExpectedAuthUser *login.UserAuth
	ExpectedErrors   map[string]error
}

func (ts *FakeOAuthTokenService) GetCurrentOAuthToken(context.Context, identity.Requester) *oauth2.Token {
	return &oauth2.Token{
		AccessToken:  ts.ExpectedAuthUser.OAuthAccessToken,
		RefreshToken: ts.ExpectedAuthUser.OAuthRefreshToken,
		Expiry:       ts.ExpectedAuthUser.OAuthExpiry,
		TokenType:    ts.ExpectedAuthUser.OAuthTokenType,
	}
}

func (ts *FakeOAuthTokenService) IsOAuthPassThruEnabled(*datasources.DataSource) bool {
	return ts.passThruEnabled
}

func (ts *FakeOAuthTokenService) InvalidateOAuthTokens(ctx context.Context, usr *login.UserAuth) error {
	ts.ExpectedAuthUser.OAuthAccessToken = ""
	ts.ExpectedAuthUser.OAuthRefreshToken = ""
	ts.ExpectedAuthUser.OAuthExpiry = time.Time{}
	return nil
}

func (ts *FakeOAuthTokenService) TryTokenRefresh(ctx context.Context, usr *login.UserAuth) error {
	if err, ok := ts.ExpectedErrors["TryTokenRefresh"]; ok {
		return err
	}
	return nil
}

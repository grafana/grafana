package auth

import (
	"context"
	"time"

	"golang.org/x/oauth2"
)

type ExternalSession struct {
	ID            int64     `xorm:"pk autoincr 'id'"`
	UserID        int64     `xorm:"user_id"`
	UserAuthID    int64     `xorm:"user_auth_id"`
	AuthModule    string    `xorm:"auth_module"`
	AccessToken   string    `xorm:"access_token"`
	IDToken       string    `xorm:"id_token"`
	RefreshToken  string    `xorm:"refresh_token"`
	SessionID     string    `xorm:"session_id"`
	SessionIDHash string    `xorm:"session_id_hash"`
	NameID        string    `xorm:"name_id"`
	NameIDHash    string    `xorm:"name_id_hash"`
	ExpiresAt     time.Time `xorm:"expires_at"`
	CreatedAt     time.Time `xorm:"created 'created_at'"`
}

func (e *ExternalSession) TableName() string {
	return "user_external_session"
}

func (e *ExternalSession) Clone() *ExternalSession {
	return &ExternalSession{
		ID:            e.ID,
		UserID:        e.UserID,
		UserAuthID:    e.UserAuthID,
		AuthModule:    e.AuthModule,
		AccessToken:   e.AccessToken,
		IDToken:       e.IDToken,
		RefreshToken:  e.RefreshToken,
		SessionID:     e.SessionID,
		SessionIDHash: e.SessionIDHash,
		NameID:        e.NameID,
		NameIDHash:    e.NameIDHash,
		ExpiresAt:     e.ExpiresAt,
		CreatedAt:     e.CreatedAt,
	}
}

type UpdateExternalSessionCommand struct {
	Token *oauth2.Token
}

type ListExternalSessionQuery struct {
	ID        int64
	NameID    string
	SessionID string
}

//go:generate mockery --name ExternalSessionStore --structname MockExternalSessionStore --outpkg authtest --filename external_session_store_mock.go --output ./authtest/
type ExternalSessionStore interface {
	// Get returns the external session
	Get(ctx context.Context, ID int64) (*ExternalSession, error)
	// List returns all external sessions fπor the given query
	List(ctx context.Context, query *ListExternalSessionQuery) ([]*ExternalSession, error)
	// Create creates a new external session for a user
	Create(ctx context.Context, extSesion *ExternalSession) error
	// Update updates an external session
	Update(ctx context.Context, ID int64, cmd *UpdateExternalSessionCommand) error
	// Delete deletes an external session
	Delete(ctx context.Context, ID int64) error
	// DeleteExternalSessionsByUserID deletes an external session
	DeleteExternalSessionsByUserID(ctx context.Context, userID int64) error
	// BatchDeleteExternalSessionsByUserIDs deletes external sessions by user IDs
	BatchDeleteExternalSessionsByUserIDs(ctx context.Context, userIDs []int64) error
}

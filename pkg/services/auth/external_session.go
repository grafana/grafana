package auth

import (
	"context"
	"time"
)

type ExternalSession struct {
	ID            int64     `xorm:"pk autoincr 'id'"`
	UserID        int64     `xorm:"user_id"`
	UserAuthID    int64     `xorm:"user_auth_id"`
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

func (e *ExternalSession) Clone() *ExternalSession {
	return &ExternalSession{
		ID:            e.ID,
		UserID:        e.UserID,
		UserAuthID:    e.UserAuthID,
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

type GetExternalSessionQuery struct {
	ID        int64
	NameID    string
	SessionID string
}

type ExternalSessionStore interface {
	// GetExternalSession returns the external session
	GetExternalSession(ctx context.Context, ID int64) (*ExternalSession, error)
	// FindExternalSessions returns all external sessions fπor the given query
	FindExternalSessions(ctx context.Context, query *GetExternalSessionQuery) ([]*ExternalSession, error)
	// CreateExternalSession creates a new external session for a user
	CreateExternalSession(ctx context.Context, extSesion *ExternalSession) error
	// DeleteExternalSession deletes an external session
	DeleteExternalSession(ctx context.Context, ID int64) error
	// DeleteExternalSessionBySessionID deletes an external session
	DeleteExternalSessionsByUserID(ctx context.Context, userID int64) error
}

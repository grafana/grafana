package usertoken

import (
	"errors"
	"fmt"
	"time"
)

var ErrInvalidSessionToken = errors.New("invalid session token")

type TokenRevokedError struct {
	UserID                int64
	TokenID               int64
	MaxConcurrentSessions int64
}

func (e *TokenRevokedError) Error() string {
	return fmt.Sprintf("%s: user token revoked", ErrInvalidSessionToken)
}

func (e *TokenRevokedError) Unwrap() error { return ErrInvalidSessionToken }

// UserToken represents a user token
type UserToken struct {
	Id                int64
	UserId            int64
	ExternalSessionId int64
	AuthToken         string
	PrevAuthToken     string
	UserAgent         string
	ClientIp          string
	AuthTokenSeen     bool
	SeenAt            int64
	RotatedAt         int64
	CreatedAt         int64
	UpdatedAt         int64
	RevokedAt         int64
	UnhashedToken     string
}

const UrgentRotateTime = 1 * time.Minute

func (t *UserToken) NeedsRotation(rotationInterval time.Duration) bool {
	return t.NeedsRotationAt(time.Now(), rotationInterval)
}

// NeedsRotationAt is NeedsRotation evaluated against the given time rather than the
// wall clock, so callers (and tests) can reason about rotation deterministically.
func (t *UserToken) NeedsRotationAt(now time.Time, rotationInterval time.Duration) bool {
	rotatedAt := time.Unix(t.RotatedAt, 0)
	if !t.AuthTokenSeen {
		return rotatedAt.Before(now.Add(-UrgentRotateTime))
	}

	return rotatedAt.Before(now.Add(-rotationInterval))
}

const rotationLeeway = 5 * time.Second

func (t *UserToken) NextRotation(rotationInterval time.Duration) time.Time {
	rotatedAt := time.Unix(t.RotatedAt, 0)
	return rotatedAt.Add(rotationInterval - rotationLeeway)
}

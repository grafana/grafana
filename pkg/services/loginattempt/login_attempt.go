package loginattempt

import (
	"context"
	"time"
)

type Service interface {
	RecordAttempt(ctx context.Context, username, IPAddress string) error
	ValidateAttempts(ctx context.Context, username string) (bool, error)
	DeleteOldLoginAttempts(ctx context.Context, cmd *DeleteOldLoginAttemptsCommand) error
}

type LoginAttempt struct {
	Id        int64
	Username  string
	IpAddress string
	Created   int64
}

type DeleteOldLoginAttemptsCommand struct {
	OlderThan   time.Time
	DeletedRows int64
}

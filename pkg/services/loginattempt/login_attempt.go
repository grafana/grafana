package loginattempt

import (
	"context"
)

type Service interface {
	RecordAttempt(ctx context.Context, username, IPAddress string) error
	Validate(ctx context.Context, username string) (bool, error)
}

type LoginAttempt struct {
	Id        int64
	Username  string
	IpAddress string
	Created   int64
}

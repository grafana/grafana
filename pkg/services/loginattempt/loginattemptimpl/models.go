package loginattemptimpl

import (
	"time"
)

type CreateLoginAttemptCommand struct {
	Username  string
	IpAddress string
}

type GetUserLoginAttemptCountQuery struct {
	Username string
	Since    time.Time
}

type DeleteOldLoginAttemptsCommand struct {
	OlderThan time.Time
}

type DeleteLoginAttemptsCommand struct {
	Username string
}

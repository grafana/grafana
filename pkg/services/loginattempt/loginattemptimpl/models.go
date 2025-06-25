package loginattemptimpl

import (
	"time"
)

type CreateLoginAttemptCommand struct {
	Username  string
	IPAddress string
}

type GetUserLoginAttemptCountQuery struct {
	Username string
	Since    time.Time
}

type GetIPLoginAttemptCountQuery struct {
	IPAddress string
	Since     time.Time
}

type DeleteOldLoginAttemptsCommand struct {
	OlderThan time.Time
}

type DeleteLoginAttemptsCommand struct {
	Username string
}

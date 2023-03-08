package loginattemptimpl

import (
	"time"

	"github.com/grafana/grafana/pkg/services/loginattempt"
)

type CreateLoginAttemptCommand struct {
	Username  string
	IpAddress string

	Result loginattempt.LoginAttempt
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

package common

import "github.com/grafana/grafana/pkg/services/user"

type UserWithRole struct {
	user.User
	Role string
}

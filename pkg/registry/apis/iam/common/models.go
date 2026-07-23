package common

import "github.com/grafana/grafana/pkg/services/user"

type UserWithRole struct {
	user.User
	Role string
}

const (
	// MaxListLimit is the maximum number of items to fetch per page.
	// This is a safeguard to prevent fetching too many items in a single request, which could lead to performance issues.
	MaxListLimit = 1000

	// DefaultListLimit is the default number of items to fetch per page
	// when no explicit limit is provided.
	DefaultListLimit = 500
)

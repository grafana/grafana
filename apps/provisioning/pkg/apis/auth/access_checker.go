package auth

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

//go:generate mockery --name AccessChecker --structname MockAccessChecker --inpackage --filename access_checker_mock.go --with-expecter

// AccessChecker provides access control checks with optional role-based fallback.
type AccessChecker interface {
	// Check performs an access check and returns nil if allowed, or an appropriate
	// API error if denied. If req.Namespace is empty, it will be filled from the
	// identity's namespace.
	Check(ctx context.Context, req authlib.CheckRequest, folder string) error

	// WithFallbackRole returns an AccessChecker configured with the specified fallback role.
	// Whether the fallback is actually applied depends on the implementation.
	WithFallbackRole(role identity.RoleType) AccessChecker
}

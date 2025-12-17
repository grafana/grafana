package auth

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// sessionAccessChecker implements AccessChecker using Grafana session identity.
type sessionAccessChecker struct {
	inner        authlib.AccessChecker
	fallbackRole identity.RoleType
}

// NewSessionAccessChecker creates an AccessChecker that gets identity from Grafana
// sessions via GetRequester(ctx). Supports optional role-based fallback via
// WithFallbackRole for backwards compatibility.
func NewSessionAccessChecker(inner authlib.AccessChecker) AccessChecker {
	return &sessionAccessChecker{
		inner:        inner,
		fallbackRole: "",
	}
}

// WithFallbackRole returns a new AccessChecker with the specified fallback role.
func (c *sessionAccessChecker) WithFallbackRole(role identity.RoleType) AccessChecker {
	return &sessionAccessChecker{
		inner:        c.inner,
		fallbackRole: role,
	}
}

// Check performs an access check with optional role-based fallback.
// Returns nil if access is allowed, or an appropriate API error if denied.
func (c *sessionAccessChecker) Check(ctx context.Context, req authlib.CheckRequest, folder string) error {
	// Get identity from Grafana session
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized(fmt.Sprintf("failed to get requester: %v", err))
	}

	// AccessPolicy identities are trusted internal callers
	if authlib.IsIdentityType(requester.GetIdentityType(), authlib.TypeAccessPolicy) {
		return nil
	}

	// Fill in namespace from identity if not provided
	if req.Namespace == "" {
		req.Namespace = requester.GetNamespace()
	}

	// Perform the access check
	rsp, err := c.inner.Check(ctx, requester, req, folder)

	// Build the GroupResource for error messages
	gr := schema.GroupResource{Group: req.Group, Resource: req.Resource}

	// No fallback configured, return result directly
	if c.fallbackRole == "" {
		if err != nil {
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
		}
		if !rsp.Allowed {
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
		}
		return nil
	}

	// Fallback is configured - apply fallback logic
	if err != nil {
		if requester.GetOrgRole().Includes(c.fallbackRole) {
			return nil // Fallback succeeded
		}
		return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
	}

	if rsp.Allowed {
		return nil
	}

	// Fall back to role for backwards compatibility
	if requester.GetOrgRole().Includes(c.fallbackRole) {
		return nil // Fallback succeeded
	}

	return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
}


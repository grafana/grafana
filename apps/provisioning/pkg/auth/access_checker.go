package auth

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// AccessChecker provides access control checks with mode-aware behavior.
// It encapsulates the differences between multi-tenant (MT) and single-tenant (ST) modes:
//   - MT mode: uses AuthInfo from access tokens, no role-based fallback
//   - ST mode: uses Requester from Grafana sessions, optional role-based fallback
type AccessChecker interface {
	// Check performs an access check and returns nil if allowed, or an appropriate
	// API error if denied. Behavior depends on the mode:
	// - MT mode: gets identity from AuthInfoFrom(ctx), no fallback
	// - ST mode: gets identity from GetRequester(ctx), applies fallback if configured
	// If req.Namespace is empty, it will be filled from the identity's namespace.
	Check(ctx context.Context, req authlib.CheckRequest, folder string) error

	// WithFallback returns a new AccessChecker configured with the specified fallback role.
	// The fallback is only applied in ST mode.
	WithFallback(role identity.RoleType) AccessChecker
}

// accessChecker implements AccessChecker by wrapping authlib.AccessChecker.
type accessChecker struct {
	inner        authlib.AccessChecker
	multiTenant  bool
	fallbackRole identity.RoleType
}

// NewAccessChecker creates an AccessChecker with mode-aware behavior.
//
// Parameters:
//   - inner: the underlying authlib.AccessChecker to delegate to
//   - multiTenant: when true (MT), uses AuthInfoFrom and no fallback;
//     when false (ST), uses GetRequester and applies fallback if configured
func NewAccessChecker(inner authlib.AccessChecker, multiTenant bool) AccessChecker {
	return &accessChecker{
		inner:        inner,
		multiTenant:  multiTenant,
		fallbackRole: "", // no fallback by default
	}
}

// WithFallback returns a new AccessChecker with the specified fallback role.
// The fallback role is only applied in ST mode.
func (c *accessChecker) WithFallback(role identity.RoleType) AccessChecker {
	return &accessChecker{
		inner:        c.inner,
		multiTenant:  c.multiTenant,
		fallbackRole: role,
	}
}

// Check performs an access check with mode-aware identity resolution and fallback.
// Returns nil if access is allowed, or an appropriate API error if denied.
func (c *accessChecker) Check(ctx context.Context, req authlib.CheckRequest, folder string) error {
	// Get identity based on mode
	id, err := c.getIdentity(ctx)
	if err != nil {
		return apierrors.NewUnauthorized(err.Error())
	}

	// AccessPolicy identities are trusted internal callers (ST->MT flow)
	if authlib.IsIdentityType(id.GetIdentityType(), authlib.TypeAccessPolicy) {
		return nil
	}

	// Fill in namespace from identity if not provided
	if req.Namespace == "" {
		req.Namespace = id.GetNamespace()
	}

	// Perform the access check
	rsp, err := c.inner.Check(ctx, id, req, folder)

	// Build the GroupResource for error messages
	gr := schema.GroupResource{Group: req.Group, Resource: req.Resource}

	// In MT mode or no fallback configured, return result directly
	if c.multiTenant || c.fallbackRole == "" {
		if err != nil {
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
		}
		if !rsp.Allowed {
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
		}
		return nil
	}

	// ST mode with fallback: apply fallback logic
	requester, ok := id.(identity.Requester)
	if !ok {
		// Can't apply fallback without Requester interface
		if err != nil {
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
		}
		if !rsp.Allowed {
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
		}
		return nil
	}

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

// getIdentity returns the appropriate identity based on the mode.
func (c *accessChecker) getIdentity(ctx context.Context) (authlib.AuthInfo, error) {
	if c.multiTenant {
		// MT mode: get identity from access token in context
		info, ok := authlib.AuthInfoFrom(ctx)
		if !ok {
			return nil, fmt.Errorf("no auth info in context for multi-tenant mode")
		}
		return info, nil
	}

	// ST mode: get identity from Grafana requester
	id, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get requester: %w", err)
	}
	return id, nil
}

package auth

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// unifiedAccessChecker implements AccessChecker with the original fallthrough behavior:
// 1. First try to get identity from access token (authlib.AuthInfoFrom)
// 2. If token exists and conditions are met, use the access checker with token identity
// 3. If no token, fall back to session identity (identity.GetRequester)
// 4. Apply role-based fallback if configured
type unifiedAccessChecker struct {
	inner                               authlib.AccessChecker
	fallbackRole                        identity.RoleType
	useExclusivelyAccessCheckerForAuthz bool
}

// NewAccessChecker creates an AccessChecker that implements the original fallthrough behavior.
//
// When useExclusivelyAccessCheckerForAuthz is true (MT mode), it will:
//   - Try to get identity from access token first
//   - If token exists, use the access checker
//   - If no token, fall back to session identity
//
// When useExclusivelyAccessCheckerForAuthz is false (ST mode), it will:
//   - Try to get identity from access token first
//   - If token exists AND is TypeAccessPolicy, use the access checker
//   - Otherwise, fall back to session identity with role-based fallback
func NewAccessChecker(inner authlib.AccessChecker, useExclusivelyAccessCheckerForAuthz bool) AccessChecker {
	return &unifiedAccessChecker{
		inner:                               inner,
		fallbackRole:                        "",
		useExclusivelyAccessCheckerForAuthz: useExclusivelyAccessCheckerForAuthz,
	}
}

// WithFallbackRole returns a new AccessChecker with the specified fallback role.
// The fallback role is applied when the access checker denies access but the user
// has the required org role. This is primarily used in ST mode for backwards compatibility.
func (c *unifiedAccessChecker) WithFallbackRole(role identity.RoleType) AccessChecker {
	return &unifiedAccessChecker{
		inner:                               c.inner,
		fallbackRole:                        role,
		useExclusivelyAccessCheckerForAuthz: c.useExclusivelyAccessCheckerForAuthz,
	}
}

// Check performs an access check with the original fallthrough behavior.
// Returns nil if access is allowed, or an appropriate API error if denied.
func (c *unifiedAccessChecker) Check(ctx context.Context, req authlib.CheckRequest, folder string) error {
	gr := schema.GroupResource{Group: req.Group, Resource: req.Resource}

	// First try: get identity from access token
	if info, ok := authlib.AuthInfoFrom(ctx); ok {
		// When running as standalone API server, the identity type may not always match TypeAccessPolicy
		// so we allow it to use the access checker if there is any auth info available
		if authlib.IsIdentityType(info.GetIdentityType(), authlib.TypeAccessPolicy) || c.useExclusivelyAccessCheckerForAuthz {
			return c.checkWithAuthInfo(ctx, info, req, folder, gr)
		}
	}

	// Fallback: get identity from Grafana session
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return apierrors.NewUnauthorized(fmt.Sprintf("no identity in context: %v", err))
	}

	return c.checkWithRequester(ctx, requester, req, folder, gr)
}

// checkWithAuthInfo performs access check using AuthInfo from access token.
func (c *unifiedAccessChecker) checkWithAuthInfo(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string, gr schema.GroupResource) error {
	// Fill in namespace from identity if not provided
	if req.Namespace == "" {
		req.Namespace = info.GetNamespace()
	}

	// Perform the access check
	rsp, err := c.inner.Check(ctx, info, req, folder)

	if err != nil {
		return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
	}
	if !rsp.Allowed {
		return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
	}
	return nil
}

// checkWithRequester performs access check using Requester from session with optional role fallback.
func (c *unifiedAccessChecker) checkWithRequester(ctx context.Context, requester identity.Requester, req authlib.CheckRequest, folder string, gr schema.GroupResource) error {
	// Fill in namespace from identity if not provided
	if req.Namespace == "" {
		req.Namespace = requester.GetNamespace()
	}

	// Perform the access check
	rsp, err := c.inner.Check(ctx, requester, req, folder)

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

	return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("%s role is required", strings.ToLower(string(c.fallbackRole))))
}

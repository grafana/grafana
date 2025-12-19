package auth

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

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
		klog.V(4).InfoS("sessionAccessChecker: failed to get requester",
			"resource", req.Resource,
			"verb", req.Verb,
			"error", err,
		)
		return apierrors.NewUnauthorized(fmt.Sprintf("failed to get requester: %v", err))
	}

	klog.V(4).InfoS("sessionAccessChecker: got requester from session",
		"identityType", requester.GetIdentityType(),
		"orgRole", requester.GetOrgRole(),
		"namespace", requester.GetNamespace(),
		"resource", req.Resource,
		"verb", req.Verb,
		"group", req.Group,
		"name", req.Name,
		"fallbackRole", c.fallbackRole,
	)

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
			klog.V(4).InfoS("sessionAccessChecker: access check error (no fallback)",
				"resource", req.Resource,
				"verb", req.Verb,
				"error", err,
			)
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
		}
		if !rsp.Allowed {
			klog.V(4).InfoS("sessionAccessChecker: access denied (no fallback)",
				"resource", req.Resource,
				"verb", req.Verb,
			)
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
		}
		klog.V(4).InfoS("sessionAccessChecker: access allowed",
			"resource", req.Resource,
			"verb", req.Verb,
		)
		return nil
	}

	// Fallback is configured - apply fallback logic
	if err != nil {
		if requester.GetOrgRole().Includes(c.fallbackRole) {
			klog.V(4).InfoS("sessionAccessChecker: access allowed via role fallback (after error)",
				"resource", req.Resource,
				"verb", req.Verb,
				"fallbackRole", c.fallbackRole,
				"orgRole", requester.GetOrgRole(),
			)
			return nil // Fallback succeeded
		}
		klog.V(4).InfoS("sessionAccessChecker: access check error (fallback failed)",
			"resource", req.Resource,
			"verb", req.Verb,
			"error", err,
			"fallbackRole", c.fallbackRole,
			"orgRole", requester.GetOrgRole(),
		)
		return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("access check failed: %w", err))
	}

	if rsp.Allowed {
		klog.V(4).InfoS("sessionAccessChecker: access allowed",
			"resource", req.Resource,
			"verb", req.Verb,
		)
		return nil
	}

	// Fall back to role for backwards compatibility
	if requester.GetOrgRole().Includes(c.fallbackRole) {
		klog.V(4).InfoS("sessionAccessChecker: access allowed via role fallback",
			"resource", req.Resource,
			"verb", req.Verb,
			"fallbackRole", c.fallbackRole,
			"orgRole", requester.GetOrgRole(),
		)
		return nil // Fallback succeeded
	}

	klog.V(4).InfoS("sessionAccessChecker: access denied (fallback role not met)",
		"resource", req.Resource,
		"verb", req.Verb,
		"fallbackRole", c.fallbackRole,
		"orgRole", requester.GetOrgRole(),
	)
	return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("%s role is required", strings.ToLower(string(c.fallbackRole))))
}

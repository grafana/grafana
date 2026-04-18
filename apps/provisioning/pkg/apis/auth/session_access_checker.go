package auth

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
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
	logger := logging.FromContext(ctx).With("logger", "sessionAccessChecker")

	// Get identity from Grafana session
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		logger.Debug("failed to get requester",
			"resource", req.Resource,
			"verb", req.Verb,
			"error", err.Error(),
		)
		return apierrors.NewUnauthorized(fmt.Sprintf("failed to get requester: %v", err))
	}

	logger.Debug("checking access",
		"identityType", requester.GetIdentityType(),
		"orgRole", requester.GetOrgRole(),
		"namespace", requester.GetNamespace(),
		"resource", req.Resource,
		"verb", req.Verb,
		"group", req.Group,
		"name", req.Name,
		"folder", folder,
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
			logger.Debug("access check error (no fallback)",
				"resource", req.Resource,
				"verb", req.Verb,
				"error", err.Error(),
			)
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("%s.%s is forbidden: %w", req.Resource, req.Group, err))
		}
		if !rsp.Allowed {
			logger.Debug("access check denied (no fallback)",
				"resource", req.Resource,
				"verb", req.Verb,
				"group", req.Group,
				"allowed", rsp.Allowed,
			)
			return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("permission denied"))
		}
		logger.Debug("access allowed",
			"resource", req.Resource,
			"verb", req.Verb,
		)
		return nil
	}

	// Fallback is configured - apply fallback logic
	if err != nil {
		if requester.GetOrgRole().Includes(c.fallbackRole) {
			logger.Debug("access allowed via role fallback (after error)",
				"resource", req.Resource,
				"verb", req.Verb,
				"fallbackRole", c.fallbackRole,
				"orgRole", requester.GetOrgRole(),
			)
			return nil // Fallback succeeded
		}
		logger.Debug("access check error (fallback failed)",
			"resource", req.Resource,
			"verb", req.Verb,
			"error", err.Error(),
			"fallbackRole", c.fallbackRole,
			"orgRole", requester.GetOrgRole(),
		)
		return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("%s.%s is forbidden: %w", req.Resource, req.Group, err))
	}

	if rsp.Allowed {
		logger.Debug("access allowed",
			"resource", req.Resource,
			"verb", req.Verb,
		)
		return nil
	}

	// Fall back to role for backwards compatibility
	if requester.GetOrgRole().Includes(c.fallbackRole) {
		logger.Debug("access allowed via role fallback",
			"resource", req.Resource,
			"verb", req.Verb,
			"fallbackRole", c.fallbackRole,
			"orgRole", requester.GetOrgRole(),
		)
		return nil // Fallback succeeded
	}

	logger.Debug("access denied (fallback role not met)",
		"resource", req.Resource,
		"verb", req.Verb,
		"group", req.Group,
		"fallbackRole", c.fallbackRole,
		"orgRole", requester.GetOrgRole(),
	)
	return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("%s role is required", strings.ToLower(string(c.fallbackRole))))
}

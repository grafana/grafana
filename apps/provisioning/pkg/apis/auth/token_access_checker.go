package auth

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// tokenAccessChecker implements AccessChecker using access tokens from context.
type tokenAccessChecker struct {
	inner authlib.AccessChecker
}

// NewTokenAccessChecker creates an AccessChecker that gets identity from access tokens
// via AuthInfoFrom(ctx). Role-based fallback is not supported.
func NewTokenAccessChecker(inner authlib.AccessChecker) AccessChecker {
	return &tokenAccessChecker{inner: inner}
}

// WithFallbackRole returns the same checker since fallback is not supported.
func (c *tokenAccessChecker) WithFallbackRole(_ identity.RoleType) AccessChecker {
	return c
}

// Check performs an access check using AuthInfo from context.
// Returns nil if access is allowed, or an appropriate API error if denied.
func (c *tokenAccessChecker) Check(ctx context.Context, req authlib.CheckRequest, folder string) error {
	logger := logging.FromContext(ctx).With("logger", "tokenAccessChecker")

	// Get identity from access token in context
	id, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		logger.Debug("no auth info in context",
			"resource", req.Resource,
			"verb", req.Verb,
			"namespace", req.Namespace,
		)
		return apierrors.NewUnauthorized("no auth info in context")
	}

	logger.Debug("checking access",
		"identityType", id.GetIdentityType(),
		"namespace", id.GetNamespace(),
		"resource", req.Resource,
		"verb", req.Verb,
		"group", req.Group,
		"name", req.Name,
		"folder", folder,
	)

	// Fill in namespace from identity if not provided
	if req.Namespace == "" {
		req.Namespace = id.GetNamespace()
	}

	// Perform the access check
	rsp, err := c.inner.Check(ctx, id, req, folder)

	// Build the GroupResource for error messages
	gr := schema.GroupResource{Group: req.Group, Resource: req.Resource}

	if err != nil {
		logger.Debug("access check error",
			"resource", req.Resource,
			"verb", req.Verb,
			"error", err.Error(),
		)
		return apierrors.NewForbidden(gr, req.Name, fmt.Errorf("%s.%s is forbidden: %w", req.Resource, req.Group, err))
	}
	if !rsp.Allowed {
		logger.Debug("access check denied",
			"resource", req.Resource,
			"verb", req.Verb,
			"group", req.Group,
			"identityType", id.GetIdentityType(),
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

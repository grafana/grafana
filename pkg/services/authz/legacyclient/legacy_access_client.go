package legacyclient

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// LegacyAccessClient checks legacy RBAC expressions without exposing the RPC contract.
// The client uses its configured transport to authenticate the caller; Subject
// identifies the identity being checked, which may differ from that caller.
type LegacyAccessClient interface {
	LegacyCheck(ctx context.Context, req LegacyCheckRequest) (bool, error)
}

type LegacyCheckRequest struct {
	Namespace string
	// Subject is a typed UID, for example user:uid or service-account:uid.
	Subject string
	// Evaluator supports the built-in permission, ALL and ANY evaluators.
	// Unsupported evaluators return an error without making an RPC.
	Evaluator accesscontrol.Evaluator
	// Teams contains contextual team UIDs, not legacy numeric membership IDs.
	Teams               []string
	SkipCache           bool
	SkipScopeResolution bool
	// GlobalEvaluation is only supported for embedded instance-global checks.
	// A nil value selects organization evaluation unless InternalIdentity is set.
	GlobalEvaluation *LegacyGlobalEvaluation
	// InternalIdentity asserts a predefined profile on the trusted embedded channel.
	// It cannot be combined with Subject, GlobalEvaluation or Restriction.
	InternalIdentity *LegacyInternalIdentity
	// Restriction limits reloaded grants to actions in the caller's effective permission map.
	// Nil is unrestricted; a non-nil value with no actions denies all.
	Restriction *LegacyActionRestriction
}

type LegacyActionRestriction struct {
	Actions []string
}

type LegacyInternalIdentity struct {
	Profile LegacyInternalIdentityProfile
}

type LegacyInternalIdentityProfile string

const (
	LegacyInternalIdentityService      LegacyInternalIdentityProfile = "service"
	LegacyInternalIdentityProvisioning LegacyInternalIdentityProfile = "provisioning"
)

func (p LegacyInternalIdentityProfile) String() string {
	return string(p)
}

type LegacyGlobalEvaluation struct {
	RequesterOrgID int64
}

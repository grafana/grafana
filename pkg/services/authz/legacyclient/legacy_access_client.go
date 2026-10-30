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
	// It cannot be combined with Subject or GlobalEvaluation.
	InternalIdentity *LegacyInternalIdentity
}

type LegacyInternalIdentity struct {
	Profile string
}

type LegacyGlobalEvaluation struct {
	RequesterOrgID int64
	// PermittedActions comes from the authenticated requester's effective global
	// permissions. It restricts reloaded grants; an empty list permits no actions.
	PermittedActions []string
}

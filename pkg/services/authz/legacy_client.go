package authz

import "github.com/grafana/grafana/pkg/services/authz/legacyclient"

// Keep the contract in a lower-level package so Access Control can use it
// without importing AuthZ's service wiring and introducing a dependency cycle.
type LegacyAccessClient = legacyclient.LegacyAccessClient

type LegacyCheckRequest = legacyclient.LegacyCheckRequest

type LegacyGlobalEvaluation = legacyclient.LegacyGlobalEvaluation

type LegacyInternalIdentity = legacyclient.LegacyInternalIdentity

type LegacyInternalIdentityProfile = legacyclient.LegacyInternalIdentityProfile

const (
	LegacyInternalIdentityService      = legacyclient.LegacyInternalIdentityService
	LegacyInternalIdentityProvisioning = legacyclient.LegacyInternalIdentityProvisioning
)

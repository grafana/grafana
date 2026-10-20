// Package versionpolicy reads the runtime version policy layer from KV. The policy types and
// resolver live in pkg/storage/unified/apistore/versionpolicy, and these aliases keep existing
// callers compiling.
package versionpolicy

import (
	"github.com/grafana/grafana/pkg/storage/unified/apistore/versionpolicy"
)

type (
	ResourceEnabledChecker = versionpolicy.ResourceEnabledChecker
	VersionPolicy          = versionpolicy.VersionPolicy
	VersionPolicyRegistry  = versionpolicy.VersionPolicyRegistry
	Resolver               = versionpolicy.Resolver
)

func NewVersionPolicyRegistry(resolver *Resolver, base ...map[string]VersionPolicy) *VersionPolicyRegistry {
	return versionpolicy.NewVersionPolicyRegistry(resolver, base...)
}

func NewResolver(order map[string][]string) *Resolver {
	return versionpolicy.NewResolver(order)
}

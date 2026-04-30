//go:build !enterprise && !pro
// +build !enterprise,!pro

package server

import (
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs"
	"github.com/grafana/grafana/pkg/services/pulse"
)

// pulseAnchoredRegistry wraps *backgroundsvcs.BackgroundServiceRegistry so the
// OSS wire graph can also pull in pulse.Service. Pulse has no other consumer
// in the graph and would otherwise be dead-code-stripped, which skips the
// ProvideService call that registers the HTTP API routes.
//
// We can't attach the dependency on any shared provider (pkg/server.New,
// backgroundsvcs.ProvideBackgroundServiceRegistry, etc.) because the Grafana
// Enterprise build copies a pre-generated wire_gen.go into this directory
// before compiling; any new parameter on a shared provider breaks that
// enterprise compile until a companion enterprise PR regenerates their file.
// Keeping the anchor in an OSS-only build-tagged file isolates the change.
//
// When wire walks back from *Server, it resolves registry.BackgroundServiceRegistry
// to this type (see wireexts_oss.go), which forces both the background service
// registry and pulse.Service into the graph.
type pulseAnchoredRegistry struct {
	*backgroundsvcs.BackgroundServiceRegistry
}

// Compile-time assertion that the anchor still satisfies the interface the
// rest of the codebase consumes.
var _ registry.BackgroundServiceRegistry = (*pulseAnchoredRegistry)(nil)

// ProvidePulseAnchoredRegistry is wired from wireexts_oss.go only; the
// enterprise wire graph binds registry.BackgroundServiceRegistry to its own
// layered implementation and never touches this provider.
func ProvidePulseAnchoredRegistry(
	r *backgroundsvcs.BackgroundServiceRegistry,
	_ pulse.Service,
) *pulseAnchoredRegistry {
	return &pulseAnchoredRegistry{BackgroundServiceRegistry: r}
}

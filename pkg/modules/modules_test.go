package modules

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestAddDependency(t *testing.T) {
	m := New(log.NewNopLogger(), nil)

	m.AddDependency(Router, OperatorServer)
	m.AddDependency("extra", InstrumentationServer, GRPCServer)

	require.Equal(t, []string{InstrumentationServer, UnifiedBackend, OperatorServer}, m.dependencyMap[Router])
	require.Equal(t, []string{InstrumentationServer, GRPCServer}, m.dependencyMap["extra"])

	// The package-level defaults are shared by every manager and must not change.
	require.Equal(t, []string{InstrumentationServer, UnifiedBackend}, dependencyMap[Router])
	require.NotContains(t, dependencyMap, "extra")
}

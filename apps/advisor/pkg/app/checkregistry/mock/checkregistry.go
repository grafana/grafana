package mock

import "github.com/grafana/grafana/apps/advisor/pkg/app/checks"

// MockCheckRegistry is a mock implementation of the CheckRegistry interface
// TODO: Add mocked checks here
type MockCheckRegistry struct {
}

func (m *MockCheckRegistry) Checks() []checks.Check {
	return []checks.Check{}
}

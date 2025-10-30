package mock

import "github.com/grafana/grafana/apps/advisor/pkg/app/checks"

type MockCheckRegistry struct {
}

func (m *MockCheckRegistry) Checks() []checks.Check {
	return []checks.Check{}
}

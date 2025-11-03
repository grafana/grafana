package mockchecks

import "github.com/grafana/grafana/apps/advisor/pkg/app/checks"

// mockchecks.CheckRegistry is a mock implementation of the checkregistry.CheckService interface
// TODO: Add mocked checks here
type CheckRegistry struct {
}

func (m *CheckRegistry) Checks() []checks.Check {
	return []checks.Check{}
}

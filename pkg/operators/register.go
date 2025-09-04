package operators

import (
	"github.com/grafana/grafana/pkg/server"

	"github.com/grafana/grafana/pkg/operators/provisioning"
)

// FIXME: we should probably move this package to pkg/server/operators
func init() {
	server.RegisterOperator(server.Operator{
		Name:        "provisioning-jobs",
		Description: "Watch provisioning jobs and manage job history cleanup",
		RunFunc:     provisioning.RunJobController,
	})

	server.RegisterOperator(server.Operator{
		// FIXME: plural or singular naming?
		Name:        "provisioning-repo",
		Description: "Watch provisioning repositories",
		RunFunc:     provisioning.RunRepoController,
	})
}

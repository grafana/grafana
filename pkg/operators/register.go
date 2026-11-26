package operators

import (
	"github.com/grafana/grafana/pkg/operators/folder"
	"github.com/grafana/grafana/pkg/operators/provisioning"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/server"
)

func init() {
	runner.Register(folder.Operator)

	// Provisioning Operators
	server.RegisterOperator(server.Operator{
		Name:        "provisioning-repo",
		Description: "Watch provisioning repositories",
		RunFunc:     provisioning.RunRepoController,
	})

	server.RegisterOperator(server.Operator{
		Name:        "provisioning-connection",
		Description: "Watch provisioning connections",
		RunFunc:     provisioning.RunConnectionController,
	})
	server.RegisterOperator(server.Operator{
		Name:        "provisioning-jobs",
		Description: "Manage provisioning job and history cleanup",
		RunFunc:     provisioning.RunJobController,
	})
	server.RegisterOperator(server.Operator{
		Name:        "provisioning-jobqueue",
		Description: "Pick and execute provisioning jobs using lease-based claiming",
		RunFunc:     provisioning.RunJobQueueController,
	})
}

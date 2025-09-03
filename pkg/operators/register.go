package operators

import (
	"github.com/grafana/grafana/pkg/operators/provisioning"
	"github.com/grafana/grafana/pkg/server"
)

func init() {
	server.RegisterOperator(server.Operator{
		Name:        "provisioning-jobs",
		Description: "Watch provisioning jobs and manage job history cleanup",
		RunFunc:     provisioning.RunJobController,
	})
}

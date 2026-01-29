package operators

import (
	"github.com/grafana/grafana/pkg/operators/iam"
	"github.com/grafana/grafana/pkg/operators/provisioning"
	"github.com/grafana/grafana/pkg/server"
)

func init() {
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
		Description: "Watch provisioning jobs and manage job history cleanup",
		RunFunc:     provisioning.RunJobController,
	})

	// IAM Operators
	server.RegisterOperator(server.Operator{
		Name:        "iam-folder-reconciler",
		Description: "Reconcile folder resources into Zanzana",
		RunFunc:     iam.RunIAMFolderReconciler,
	})
}

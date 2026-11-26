package operators

import (
	"github.com/grafana/grafana/pkg/operators/folder"
	"github.com/grafana/grafana/pkg/operators/provisioning"
	"github.com/grafana/grafana/pkg/operators/runner"
	"github.com/grafana/grafana/pkg/server"
)

func init() {
	server.RegisterOperator(server.Operator{
		Name:        "folder-controller",
		Description: "Delete the contents of folders being cascade-deleted",
		RunFunc:     folder.RunFolderController,
	})
	runner.Register(provisioning.RepoOperator)
	runner.Register(provisioning.ConnectionOperator)
	runner.Register(provisioning.JobsOperator)
	runner.Register(provisioning.JobQueueOperator)
}

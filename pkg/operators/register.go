package operators

import (
	"github.com/grafana/grafana/pkg/operators/folder"
	"github.com/grafana/grafana/pkg/operators/provisioning"
	"github.com/grafana/grafana/pkg/operators/runner"
)

func init() {
	runner.Register(folder.Operator)
	runner.Register(provisioning.RepoOperator)
	runner.Register(provisioning.ConnectionOperator)
	runner.Register(provisioning.JobsOperator)
	runner.Register(provisioning.JobQueueOperator)
}

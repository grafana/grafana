package standalone

import (
	"github.com/urfave/cli/v2"
)

type BuildInfo struct {
	Version          string
	Commit           string
	EnterpriseCommit string
	BuildBranch      string
	BuildStamp       string
}

type APIServerFactory interface {
	GetCLICommand(info BuildInfo) *cli.Command
	GetSandboxCommand() *cli.Command
}

// NOOP
func ProvideAPIServerFactory() APIServerFactory {
	return &NoOpAPIServerFactory{}
}

type NoOpAPIServerFactory struct{}

func (f *NoOpAPIServerFactory) GetCLICommand(info BuildInfo) *cli.Command {
	return nil
}

func (f *NoOpAPIServerFactory) GetSandboxCommand() *cli.Command {
	return nil
}

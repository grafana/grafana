package router

import "github.com/urfave/cli/v2"

// BuildInfo carries version metadata into the router CLI command, mirroring the
// standalone apiserver's BuildInfo. Kept local so pkg/router stays free of
// apiserver dependencies.
type BuildInfo struct {
	Version     string
	Commit      string
	BuildBranch string
	BuildStamp  string
}

// RouterFactory yields the `grafana router` CLI command. OSS returns nil (the
// command is hidden); the enterprise build returns the real command that runs
// the standalone GrafanaRouter against a remote apiserver. This mirrors the
// standalone APIServerFactory split.
type RouterFactory interface {
	GetCLICommand(info BuildInfo) *cli.Command
}

// ProvideRouterFactory is the OSS binding: a no-op factory. Wire replaces it
// with the enterprise factory in enterprise/pro builds.
func ProvideRouterFactory() RouterFactory { return &NoOpRouterFactory{} }

type NoOpRouterFactory struct{}

func (f *NoOpRouterFactory) GetCLICommand(BuildInfo) *cli.Command { return nil }

package commands

import (
	"fmt"

	"github.com/urfave/cli/v2"
)

func (d Deps) cmdWire() *cli.Command {
	return &cli.Command{
		Name:  "wire",
		Usage: "Print standardized wire layout pointers for OSS vs Enterprise",
		Subcommands: []*cli.Command{
			{
				Name:  "patterns",
				Usage: "Describe the split between wire.go, wireexts_oss.go, and wireexts_enterprise.go",
				Action: func(c *cli.Context) error {
					_, _ = fmt.Fprint(c.App.Writer, wirePatternsDoc)
					return nil
				},
			},
		},
	}
}

const wirePatternsDoc = `Wire split (pkg/server):

1) wire.go (build tag: wireinject)
   Shared injector graph used by both OSS and Enterprise. Put cross-cutting sets here.

2) wireexts_oss.go (build tag: wireinject && oss)
   OSS-only providers and bindings.

3) wireexts_enterprise.go (build tag: wireinject && (enterprise || pro))
   Enterprise-only providers. This is where Enterprise-specific implementations are wired.

Typical dependency patterns:

A) OSS vs Enterprise capability (preferred for anything “enterprise-only”)
   - Define an interface in OSS (e.g. under pkg/services/...) and depend on that
     interface from HTTP/API or shared services wired in wire.go.
   - wire.Bind the OSS implementation in wireexts_oss.go.
   - wire.Bind the Enterprise implementation in wireexts_enterprise.go.
   - Put Enterprise-only concrete types under pkg/extensions/... with
     //go:build enterprise || pro so they are not compiled into the OSS binary.

   Do not use cfg.IsEnterprise / setting.IsEnterprise as the only gate for
   licensed or security-sensitive behavior inside one OSS implementation: the
   OSS repo is open source—those flags are not a substitute for a separate
   type only linked in the enterprise Wire graph.

B) New dependency used from Enterprise code only
   - Prefer wiring via Enterprise sets in wireexts_enterprise.go.
   - If the module is not pulled transitively, add a blank import to
     pkg/extensions/enterprise_imports.go (see: grafdev imports explain).

C) Enterprise initializes an OSS dependency directly
   - Possible but couples repos; prefer (A) for long-lived seams.

Regenerate graphs from OSS repo:
  make gen-go          # OSS graph
  make gen-enterprise-go   # Enterprise graph (when local/Makefile sets tags)

`

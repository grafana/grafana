package main

import (
	"fmt"

	"github.com/urfave/cli/v2"
)

func cmdWire() *cli.Command {
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

A) Change OSS service behavior when Enterprise is linked
   - Define an interface in OSS and accept it in the OSS wire graph.
   - Bind the OSS implementation in wireexts_oss.go.
   - Bind the Enterprise override in wireexts_enterprise.go.

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

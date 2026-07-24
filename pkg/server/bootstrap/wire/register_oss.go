//go:build !enterprise && !pro
// +build !enterprise,!pro

package wire

import "github.com/grafana/grafana/pkg/server"

func init() {
	server.RegisterInitializers(
		Initialize,
		InitializeForTest,
		InitializeForCLI,
		InitializeAPIServerFactory,
	)
}

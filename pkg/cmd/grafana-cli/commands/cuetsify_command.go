package commands

import (
	gerrors "errors"

	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/codegen"
)

var ctx = cuecontext.New()

// The only import statement we currently allow in any models.cue file
const allowedImport = "github.com/grafana/grafana/packages/grafana-schema/src/schema"

var importMap = map[string]string{
	allowedImport: "@grafana/schema",
}

// nolint: gocyclo
func (cmd Command) generateTypescript(c utils.CommandLine) error {
	root := c.String("grafana-root")
	if root == "" {
		return gerrors.New("must provide path to the root of a Grafana repository checkout")
	}

	wd, err := codegen.CuetsifyPlugins(ctx, root)
	if err != nil {
		return err
	}

	if c.Bool("diff") {
		return wd.Verify()
	}

	return wd.Write()
}

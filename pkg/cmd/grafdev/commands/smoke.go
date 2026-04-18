package commands

import (
	"fmt"
	"os/exec"

	"github.com/urfave/cli/v2"
)

func (d Deps) cmdSmoke() *cli.Command {
	return &cli.Command{
		Name:  "smoke",
		Usage: "Run the same checks as verify, then `make -n enterprise-dev` in OSS",
		Action: func(c *cli.Context) error {
			p, err := d.mustResolve(c)
			if err != nil {
				return err
			}
			if err := VerifyLayout(p); err != nil {
				return err
			}
			makeBin, err := exec.LookPath("make")
			if err != nil {
				return err
			}
			cmd := exec.Command(makeBin, "-n", "enterprise-dev")
			cmd.Dir = p.OSS
			out, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("make -n enterprise-dev: %w\n%s", err, string(out))
			}
			_, _ = fmt.Fprintf(c.App.Writer, "smoke: verify ok; make -n enterprise-dev ok\n%s", string(out))
			return nil
		},
	}
}

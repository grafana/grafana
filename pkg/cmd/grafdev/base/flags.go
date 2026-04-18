package base

import (
	"strings"

	"github.com/urfave/cli/v2"
)

// GlobalPathFlags returns --oss / --enterprise for the root App and the `ge` subcommand.
func GlobalPathFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{
			Name:    "oss",
			Usage:   "Path to Grafana OSS checkout (default: walk parents for go.mod or GRAFANA_DEV_OSS)",
			EnvVars: []string{"GRAFANA_DEV_OSS"},
		},
		&cli.StringFlag{
			Name:    "enterprise",
			Usage:   "Path to grafana-enterprise checkout (default: $GRAFANA_DEV_ENTERPRISE or sibling ../grafana-enterprise)",
			EnvVars: []string{"GRAFANA_DEV_ENTERPRISE"},
		},
	}
}

// FromContext returns the innermost explicitly set flag (urfave/cli v2 Lineage), else c.String.
func FromContext(c *cli.Context, name string) string {
	for _, cur := range c.Lineage() {
		if cur.IsSet(name) {
			return strings.TrimSpace(cur.String(name))
		}
	}
	return strings.TrimSpace(c.String(name))
}

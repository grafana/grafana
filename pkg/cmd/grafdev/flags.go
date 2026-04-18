package main

import (
	"strings"

	"github.com/urfave/cli/v2"
)

// globalPathFlags returns --oss / --enterprise definitions used on the root App
// and on the `ge` command so paths can be set either before or immediately after `ge`.
func globalPathFlags() []cli.Flag {
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

// flagFromContext returns the innermost explicitly set flag value walking child → parent
// (urfave/cli v2 Lineage order), otherwise c.String(name) (e.g. env default from urfave).
func flagFromContext(c *cli.Context, name string) string {
	for _, cur := range c.Lineage() {
		if cur.IsSet(name) {
			return strings.TrimSpace(cur.String(name))
		}
	}
	return strings.TrimSpace(c.String(name))
}

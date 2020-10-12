package main

import (
	"fmt"
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/urfave/cli/v2"
)

func main() {
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	output := zerolog.ConsoleWriter{
		Out:        os.Stderr,
		PartsOrder: []string{"message"},
		FormatMessage: func(msg interface{}) string {
			return fmt.Sprintf("* %s", msg)
		},
	}
	log.Logger = log.Output(output)

	app := cli.App{
		Name:   "query-untriaged",
		Usage:  "Query GitHub for untriaged Grafana issues",
		Action: action,
	}
	app.Run(os.Args)
}

func action(c *cli.Context) error {
	log.Info().Msg("Querying GitHub for untriaged Grafana issues...")
	return nil
}

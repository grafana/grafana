package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"regexp"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/metrics"
)

func PublishMetrics(c *cli.Context) error {
	apiKey := c.Args().Get(0)

	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return cli.Exit(fmt.Sprintf("Reading from stdin failed: %s", err), 1)
	}

	reMetrics := regexp.MustCompile(`(?ms)^Metrics: (\{.+\})`)
	ms := reMetrics.FindSubmatch(input)
	if len(ms) == 0 {
		return cli.Exit(fmt.Sprintf("Input on wrong format: %q", string(input)), 1)
	}

	m := map[string]string{}
	if err := json.Unmarshal(ms[1], &m); err != nil {
		return cli.Exit(fmt.Sprintf("decoding metrics failed: %s", err), 1)
	}

	log.Printf("Received metrics %+v", m)

	if err := metrics.Publish(m, apiKey); err != nil {
		return cli.Exit(fmt.Sprintf("publishing metrics failed: %s", err), 1)
	}

	return nil
}

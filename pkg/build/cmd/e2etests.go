package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/e2eutil"
)

func EndToEndTests(c *cli.Context) error {
	var (
		tries = c.Int("tries")
		suite = c.String("suite")
		host  = c.String("host")
		video = c.String("video")
	)

	log.Printf("Running Grafana e2e tests")

	port := c.Int("port")
	env := append(os.Environ(), fmt.Sprintf("PORT=%d", port))

	grafanaServer := e2eutil.Server(host, port)
	// TODO implement grafanaServer.Start()
	grafanaServer.Wait()

	var err error
	for i := 0; i < tries; i++ {
		log.Printf("Running e2e test suite attempt #%d", i+1)
		//nolint:gosec
		cmd := exec.Command("./e2e/run-suite", suite, video)
		cmd.Env = env
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err = cmd.Run()
		if err == nil {
			break
		}

		log.Printf("Running the test suite failed: %s", err)
	}
	if err != nil {
		return cli.Exit(fmt.Sprintf("e2e tests failed: %s", err), 1)
	}

	return nil
}

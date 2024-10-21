package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/npm"
)

func NpmRetrieveAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	tag := c.String("tag")
	if tag == "" {
		return fmt.Errorf("no tag version specified, exitting")
	}

	if strings.Contains(tag, "security") {
		log.Printf("skipping npm publish because version '%s' has 'security'", tag)
		return nil
	}

	prereleaseBucket := strings.TrimSpace(os.Getenv("PRERELEASE_BUCKET"))
	if prereleaseBucket == "" {
		return cli.Exit("the environment variable PRERELEASE_BUCKET must be set", 1)
	}

	err := npm.FetchNpmPackages(c.Context, tag, prereleaseBucket)
	if err != nil {
		return err
	}
	return nil
}

func NpmStoreAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	tag := c.String("tag")
	if tag == "" {
		return fmt.Errorf("no tag version specified, exiting")
	}

	if strings.Contains(tag, "security") {
		log.Printf("skipping npm publish because version '%s' has 'security'", tag)
		return nil
	}

	prereleaseBucket := strings.TrimSpace(os.Getenv("PRERELEASE_BUCKET"))
	if prereleaseBucket == "" {
		return cli.Exit("the environment variable PRERELEASE_BUCKET must be set", 1)
	}

	err := npm.StoreNpmPackages(c.Context, tag, prereleaseBucket)
	if err != nil {
		return err
	}
	return nil
}

func NpmReleaseAction(c *cli.Context) error {
	if c.NArg() > 0 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit("", 1)
	}

	tag := c.String("tag")
	if tag == "" {
		return fmt.Errorf("no tag version specified, exitting")
	}

	if strings.Contains(tag, "security") {
		log.Printf("skipping npm publish because version '%s' has 'security'", tag)
		return nil
	}

	err := npm.PublishNpmPackages(c.Context, tag)
	if err != nil {
		return err
	}

	return nil
}

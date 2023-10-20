package main

import (
	"fmt"
	"os"
	"os/exec"
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

	cmd := exec.Command("git", "checkout", ".")
	if err := cmd.Run(); err != nil {
		fmt.Println("command failed to run, err: ", err)
		return err
	}

	err := npm.PublishNpmPackages(c.Context, tag)
	if err != nil {
		return err
	}

	return nil
}

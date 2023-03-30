package main

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/env"
	"github.com/grafana/grafana/pkg/build/git"
)

// checkOpts are options used to create a new GitHub check for the enterprise downstream test.
type checkOpts struct {
	SHA    string
	URL    string
	Branch string
	PR     int
}

func getCheckOpts(args []string) (*checkOpts, error) {
	branch, ok := env.Lookup("DRONE_SOURCE_BRANCH", args)
	if !ok {
		return nil, cli.Exit("Unable to retrieve build source branch", 1)
	}

	var (
		rgx     = git.PRCheckRegexp()
		matches = rgx.FindStringSubmatch(branch)
	)

	sha, ok := env.Lookup("SOURCE_COMMIT", args)
	if !ok {
		if matches == nil || len(matches) <= 1 {
			return nil, cli.Exit("Unable to retrieve source commit", 1)
		}
		sha = matches[2]
	}

	url, ok := env.Lookup("DRONE_BUILD_LINK", args)
	if !ok {
		return nil, cli.Exit(`missing environment variable "DRONE_BUILD_LINK"`, 1)
	}

	prStr, ok := env.Lookup("OSS_PULL_REQUEST", args)
	if !ok {
		if matches == nil || len(matches) <= 1 {
			return nil, cli.Exit("Unable to retrieve PR number", 1)
		}

		prStr = matches[1]
	}

	pr, err := strconv.Atoi(prStr)
	if err != nil {
		return nil, err
	}

	return &checkOpts{
		Branch: branch,
		PR:     pr,
		SHA:    sha,
		URL:    url,
	}, nil
}

// EnterpriseCheckBegin creates the GitHub check and signals the beginning of the downstream build / test process
func EnterpriseCheckBegin(c *cli.Context) error {
	var (
		ctx    = c.Context
		client = git.NewGitHubClient(ctx, c.String("github-token"))
	)

	opts, err := getCheckOpts(os.Environ())
	if err != nil {
		return err
	}

	if _, err = git.CreateEnterpriseStatus(ctx, client.Repositories, opts.SHA, opts.URL, "pending"); err != nil {
		return err
	}

	return nil
}

func EnterpriseCheckSuccess(c *cli.Context) error {
	return completeEnterpriseCheck(c, true)
}

func EnterpriseCheckFail(c *cli.Context) error {
	return completeEnterpriseCheck(c, false)
}

func completeEnterpriseCheck(c *cli.Context, success bool) error {
	var (
		ctx    = c.Context
		client = git.NewGitHubClient(ctx, c.String("github-token"))
	)

	// Update the pull request labels
	opts, err := getCheckOpts(os.Environ())
	if err != nil {
		return err
	}

	status := "failure"
	if success {
		status = "success"
	}

	// Update the GitHub check...
	if _, err := git.CreateEnterpriseStatus(ctx, client.Repositories, opts.SHA, opts.URL, status); err != nil {
		return err
	}

	// Delete branch if needed
	log.Printf("Checking branch '%s' against '%s'", git.PRCheckRegexp().String(), opts.Branch)
	if git.PRCheckRegexp().MatchString(opts.Branch) {
		log.Println("Deleting branch", opts.Branch)
		if err := git.DeleteEnterpriseBranch(ctx, client.Git, opts.Branch); err != nil {
			return fmt.Errorf("error deleting enterprise branch: %w", err)
		}
	}

	label := "enterprise-failed"
	if success {
		label = "enterprise-ok"
	}

	return git.AddLabelToPR(ctx, client.Issues, opts.PR, label)
}

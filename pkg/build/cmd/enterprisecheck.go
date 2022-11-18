package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/grafana/grafana/pkg/build/env"
	"github.com/grafana/grafana/pkg/build/git"
	"github.com/urfave/cli/v2"
)

// checkOpts are options used to create a new GitHub check for the enterprise downstream test.
type checkOpts struct {
	SHA string
	URL string
}

func getCheckOpts(args []string) (*checkOpts, error) {
	sha, ok := env.Lookup("OSS_COMMIT_SHA", args)
	if !ok {
		return nil, cli.Exit(`missing environment variable "OSS_PULL_REQUEST"`, 1)
	}

	url, ok := env.Lookup("DRONE_BUILD_LINK", args)
	if !ok {
		return nil, cli.Exit(`missing environment variable "DRONE_BUILD_LINK"`, 1)
	}

	return &checkOpts{
		URL: url,
		SHA: sha,
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

	check, err := git.CreateEnterpriseBuildCheck(ctx, client.Checks, opts.SHA, opts.URL)
	if err != nil {
		return err
	}

	fmt.Fprintf(c.App.Writer, "%d", *check.ID)
	return nil
}

type completeCheckOpts struct {
	branch string
	prID   int
}

func getCompleteCheckOpts(args []string) (*completeCheckOpts, error) {
	branch, ok := env.Lookup("DRONE_SOURCE_BRANCH", args)
	if !ok {
		return nil, cli.Exit("Unable to retrieve build source branch", 1)
	}

	prStr, ok := env.Lookup("OSS_PULL_REQUEST", args)
	if !ok {
		matches := git.PRCheckRegexp().FindStringSubmatch(branch)
		if matches == nil || len(matches) <= 1 {
			return nil, cli.Exit("Unable to retrieve PR number", 1)
		}

		prStr = matches[1]
	}

	pr, err := strconv.Atoi(prStr)
	if err != nil {
		return nil, err
	}

	return &completeCheckOpts{
		branch: branch,
		prID:   pr,
	}, nil
}

func EnterpriseCheckSuccess(c *cli.Context) error {
	return completeEnterpriseCheck(c, true)
}

func EnterpriseCheckFail(c *cli.Context) error {
	return completeEnterpriseCheck(c, true)
}

func completeEnterpriseCheck(c *cli.Context, success bool) error {
	var (
		ctx     = c.Context
		client  = git.NewGitHubClient(ctx, c.String("github-token"))
		checkID = c.Int64("check-id")
	)

	// Update the pull request labels
	opts, err := getCompleteCheckOpts(os.Environ())
	if err != nil {
		return err
	}

	status := "failure"
	if success {
		status = "success"
	}

	// Update the GitHub check...
	if err := git.UpdateEnterpriseBuildCheck(ctx, client.Checks, checkID, status); err != nil {
		return err
	}

	// Delete branch if needed
	if git.PRCheckRegexp().MatchString(opts.branch) {
		if err := git.DeleteEnterpriseBranch(ctx, client.Git, opts.branch); err != nil {
			return nil
		}
	}

	label := "enterprise-failed"
	if success {
		label = "enterprise-ok"
	}

	return git.AddLabelToPR(ctx, client.Issues, opts.prID, label)
}

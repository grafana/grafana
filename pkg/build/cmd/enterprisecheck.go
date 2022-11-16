package main

import (
	"log"
	"os"
	"strconv"

	"github.com/grafana/grafana/pkg/build/git"
	"github.com/urfave/cli/v2"
)

func EnterpriseCheckBegin(c *cli.Context) error {
	if c.NArg() != 1 {
		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.NewExitError(err.Error(), 1)
		}
		return cli.NewExitError("", 1)
	}

	var (
		ctx          = c.Context
		ghClient     = git.NewGitHubClient(ctx, c.String("github-token"))
		reBranch     = git.PRCheckRegexp()
		isSuccessStr = c.Args().Get(0)
	)

	isSuccess, err := strconv.ParseBool(isSuccessStr)
	if err != nil {
		return cli.NewExitError("The argument should be a boolean", 1)
	}

	branch, ok := os.LookupEnv("DRONE_SOURCE_BRANCH")
	if !ok {
		return cli.NewExitError("Unable to retrieve build source branch", 1)
	}

	// Add "enterprise-failed" / "-ok" label to OSS PR
	// PR number is in the env variable for downstream builds
	// and in the branch name for GH workflow builds
	prStr, ok := os.LookupEnv("OSS_PULL_REQUEST")
	if !ok {
		matches := reBranch.FindStringSubmatch(branch)
		if matches == nil || len(matches) <= 1 {
			return cli.NewExitError("Unable to retrieve PR number", 1)
		}

		prStr = matches[1]
	}
	pr, err := strconv.Atoi(prStr)
	if err != nil {
		return cli.NewExitError(err.Error(), 1)
	}

	label := "enterprise-failed"
	if isSuccess {
		label = "enterprise-ok"
	}
	log.Printf("Adding label %s to OSS PR %d...", label, pr)
	if err := git.AddLabelToPR(ctx, ghClient, label, pr); err != nil {
		return err
	}

	// Delete branch if needed
	if reBranch.MatchString(branch) {
		log.Printf("Deleting Enterprise branch %s...", branch)

		err = git.DeleteEnterpriseBranch(ctx, ghClient, branch)
		if err != nil {
			return nil
		}
	}

	// Add comment to the OSS PR in case of failure
	if !isSuccess {
		log.Printf("Creating build failed comment for PR %d...", pr)

		err = ghClient.CreateEnterpriseBuildFailedComment(ctx, pr)
		if err != nil {
			return nil
		}
	}

	return nil
}

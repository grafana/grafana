package git

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/google/go-github/v45/github"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/build/stringutil"
)

const (
	MainBranch                 = "main"
	HomeDir                    = "."
	RepoOwner                  = "grafana"
	OSSRepo                    = "grafana"
	EnterpriseRepo             = "grafana-enterprise"
	EnterpriseCheckName        = "Grafana Enterprise"
	EnterpriseCheckDescription = "Downstream tests to ensure that your changes are compatible with Grafana Enterprise"
)

var EnterpriseCheckLabels = []string{"enterprise-ok", "enterprise-failed", "enterprise-override"}

var (
	ErrorNoDroneBuildLink = errors.New("no drone build link")
)

type GitService interface {
	DeleteRef(ctx context.Context, owner string, repo string, ref string) (*github.Response, error)
}

type LabelsService interface {
	ListLabelsByIssue(ctx context.Context, owner string, repo string, number int, opts *github.ListOptions) ([]*github.Label, *github.Response, error)
	RemoveLabelForIssue(ctx context.Context, owner string, repo string, number int, label string) (*github.Response, error)
	AddLabelsToIssue(ctx context.Context, owner string, repo string, number int, labels []string) ([]*github.Label, *github.Response, error)
}

type CommentService interface {
	CreateComment(ctx context.Context, owner string, repo string, number int, comment *github.IssueComment) (*github.IssueComment, *github.Response, error)
}

type StatusesService interface {
	CreateStatus(ctx context.Context, owner, repo, ref string, status *github.RepoStatus) (*github.RepoStatus, *github.Response, error)
}

// NewGitHubClient creates a new Client using the provided GitHub token if not empty.
func NewGitHubClient(ctx context.Context, token string) *github.Client {
	var tc *http.Client
	if token != "" {
		ts := oauth2.StaticTokenSource(&oauth2.Token{
			AccessToken: token,
		})
		tc = oauth2.NewClient(ctx, ts)
	}

	return github.NewClient(tc)
}

func PRCheckRegexp() *regexp.Regexp {
	reBranch, err := regexp.Compile(`^prc-([0-9]+)-([A-Za-z0-9]+)\/(.+)$`)
	if err != nil {
		panic(fmt.Sprintf("Failed to compile regexp: %s", err))
	}

	return reBranch
}

func AddLabelToPR(ctx context.Context, client LabelsService, prID int, newLabel string) error {
	// Check existing labels
	labels, _, err := client.ListLabelsByIssue(ctx, RepoOwner, OSSRepo, prID, nil)
	if err != nil {
		return err
	}

	duplicate := false
	for _, label := range labels {
		if *label.Name == newLabel {
			duplicate = true
			continue
		}

		// Delete existing "enterprise-xx" labels
		if stringutil.Contains(EnterpriseCheckLabels, *label.Name) {
			_, err := client.RemoveLabelForIssue(ctx, RepoOwner, OSSRepo, prID, *label.Name)
			if err != nil {
				return err
			}
		}
	}

	if duplicate {
		return nil
	}

	_, _, err = client.AddLabelsToIssue(ctx, RepoOwner, OSSRepo, prID, []string{newLabel})
	if err != nil {
		return err
	}

	return nil
}

func DeleteEnterpriseBranch(ctx context.Context, client GitService, branchName string) error {
	ref := "heads/" + branchName
	if _, err := client.DeleteRef(ctx, RepoOwner, EnterpriseRepo, ref); err != nil {
		return err
	}

	return nil
}

// CreateEnterpriseStatus sets the status on a commit for the enterprise build check.
func CreateEnterpriseStatus(ctx context.Context, client StatusesService, sha, link, status string) (*github.RepoStatus, error) {
	check, _, err := client.CreateStatus(ctx, RepoOwner, OSSRepo, sha, &github.RepoStatus{
		Context:     github.String(EnterpriseCheckName),
		Description: github.String(EnterpriseCheckDescription),
		TargetURL:   github.String(link),
		State:       github.String(status),
	})

	if err != nil {
		return nil, err
	}

	return check, nil
}

func CreateEnterpriseBuildFailedComment(ctx context.Context, client CommentService, link string, prID int) error {
	body := fmt.Sprintf("Drone build failed: %s", link)

	_, _, err := client.CreateComment(ctx, RepoOwner, OSSRepo, prID, &github.IssueComment{
		Body: &body,
	})
	if err != nil {
		return err
	}

	return nil
}

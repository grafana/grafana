package git

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/google/go-github/v45/github"
	"github.com/grafana/grafana/pkg/build/stringutil"
	"golang.org/x/oauth2"
)

const (
	MainBranch          = "main"
	HomeDir             = "."
	RepoOwner           = "grafana"
	OSSRepo             = "grafana"
	EnterpriseRepo      = "grafana-enterprise"
	EnterpriseCheckName = "grafana-enterprise downstream tests"
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

type ChecksService interface {
	CreateCheckRun(ctx context.Context, owner, repo string, opts github.CreateCheckRunOptions) (*github.CheckRun, *github.Response, error)
	GetCheckRun(ctx context.Context, owner, repo string, checkRunID int64) (*github.CheckRun, *github.Response, error)
	UpdateCheckRun(ctx context.Context, owner, repo string, checkRunID int64, opts github.UpdateCheckRunOptions) (*github.CheckRun, *github.Response, error)
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
	reBranch, err := regexp.Compile(`^pr-check-([0-9]+)\/(.+)$`)
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

	labelAlreadyExist := false
	for _, label := range labels {
		if *label.Name == newLabel {
			labelAlreadyExist = true
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

	// Add new label
	if labelAlreadyExist {
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
	_, err := client.DeleteRef(ctx, RepoOwner, EnterpriseRepo, ref)
	if err != nil {
		return err
	}

	return nil
}

func CreateEnterpriseBuildCheck(ctx context.Context, client ChecksService, sha string, link string) (*github.CheckRun, error) {
	check, _, err := client.CreateCheckRun(ctx, RepoOwner, OSSRepo, github.CreateCheckRunOptions{
		Name:       EnterpriseCheckName,
		HeadSHA:    sha,
		DetailsURL: github.String(link),
		Status:     github.String("in_progress"),
	})

	if err != nil {
		return nil, err
	}

	return check, nil
}

func UpdateEnterpriseBuildCheck(ctx context.Context, client ChecksService, checkID int64, status string) error {
	check, _, err := client.GetCheckRun(ctx, RepoOwner, OSSRepo, checkID)
	if err != nil {
		return err
	}

	if _, _, err := client.UpdateCheckRun(ctx, RepoOwner, OSSRepo, checkID, github.UpdateCheckRunOptions{
		Name:       *check.Name,
		DetailsURL: check.DetailsURL,
		Status:     github.String("completed"),
		Conclusion: github.String(status),
	}); err != nil {
		return err
	}

	return nil
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

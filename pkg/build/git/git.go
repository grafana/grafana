package git

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	"github.com/google/go-github/v69/github"
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

func PRCheckRegexp() *regexp.Regexp {
	reBranch, err := regexp.Compile(`^prc-([0-9]+)-([A-Za-z0-9]+)\/(.+)$`)
	if err != nil {
		panic(fmt.Sprintf("Failed to compile regexp: %s", err))
	}

	return reBranch
}

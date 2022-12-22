package store

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/go-github/v45/github"
	"golang.org/x/oauth2"
)

type githubHelper struct {
	repoOwner string
	repoName  string
	client    *github.Client
}

func newGithubHelper(ctx context.Context, uri string, token string) (*githubHelper, error) {
	v, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}

	path := strings.TrimPrefix(v.Path, "/")
	path = strings.TrimSuffix(path, ".git")
	idx := strings.Index(path, "/")
	if idx < 1 {
		return nil, fmt.Errorf("invalid url")
	}

	if token == "" {
		return nil, fmt.Errorf("unauthorized: No token present")
	}
	ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
	tc := oauth2.NewClient(ctx, ts)
	return &githubHelper{
		client:    github.NewClient(tc),
		repoOwner: path[:idx],
		repoName:  path[idx+1:],
	}, nil
}

func (g *githubHelper) getRef(ctx context.Context, branch string) (*github.Reference, *github.Response, error) {
	return g.client.Git.GetRef(ctx, g.repoOwner, g.repoName, "refs/heads/"+branch)
}

func (g *githubHelper) createRef(ctx context.Context, base string, branch string) (ref *github.Reference, rsp *github.Response, err error) {
	var baseRef *github.Reference
	if baseRef, rsp, err = g.client.Git.GetRef(ctx, g.repoOwner, g.repoName, "refs/heads/"+base); err != nil {
		return nil, rsp, err
	}
	newRef := &github.Reference{
		Ref:    github.String("refs/heads/" + branch),
		Object: &github.GitObject{SHA: baseRef.Object.SHA},
	}
	return g.client.Git.CreateRef(ctx, g.repoOwner, g.repoName, newRef)
}

func (g *githubHelper) getRepo(ctx context.Context) (*github.Repository, *github.Response, error) {
	return g.client.Repositories.Get(ctx, g.repoOwner, g.repoName)
}

// pushCommit creates the commit in the given reference using the given tree.
func (g *githubHelper) pushCommit(ctx context.Context, ref *github.Reference, cmd *WriteValueRequest) (err error) {
	// Create a tree with what to commit.
	entries := []*github.TreeEntry{
		{
			Path:    github.String(cmd.Path),
			Type:    github.String("blob"),
			Content: github.String(string(cmd.Body)),
			Mode:    github.String("100644"),
		},
	}

	tree, _, err := g.client.Git.CreateTree(ctx, g.repoOwner, g.repoName, *ref.Object.SHA, entries)
	if err != nil {
		return err
	}

	// Get the parent commit to attach the commit to.
	parent, _, err := g.client.Repositories.GetCommit(ctx, g.repoOwner, g.repoName, *ref.Object.SHA, nil)
	if err != nil {
		return err
	}

	// This is not always populated, but is needed.
	parent.Commit.SHA = parent.SHA

	user := cmd.User
	name := firstRealString(user.Name, user.Login, user.Email, "?")
	email := firstRealString(user.Email, user.Login, user.Name, "?")

	// Create the commit using the tree.
	date := time.Now()
	author := &github.CommitAuthor{
		Date:  &date,
		Name:  &name,
		Email: &email,
	}
	commit := &github.Commit{Author: author, Message: &cmd.Message, Tree: tree, Parents: []*github.Commit{parent.Commit}}
	newCommit, _, err := g.client.Git.CreateCommit(ctx, g.repoOwner, g.repoName, commit)
	if err != nil {
		return err
	}

	// Attach the commit to the main branch.
	ref.Object.SHA = newCommit.SHA
	_, _, err = g.client.Git.UpdateRef(ctx, g.repoOwner, g.repoName, ref, false)
	return err
}

type makePRCommand struct {
	title      string
	body       string
	headBranch string
	baseBranch string
}

func (g *githubHelper) createPR(ctx context.Context, cmd makePRCommand) (*github.PullRequest, *github.Response, error) {
	newPR := &github.NewPullRequest{
		Title:               &cmd.title,
		Head:                &cmd.headBranch,
		Base:                &cmd.baseBranch,
		Body:                &cmd.body,
		MaintainerCanModify: github.Bool(true),
	}

	return g.client.PullRequests.Create(ctx, g.repoOwner, g.repoName, newPR)
}

// func (g *githubHelper) getPR(config *Config, prSubject string) (*github.PullRequest, error) {

// 	opts := github.PullRequestListOptions{}

// 	prs, _, err := githubClient.PullRequests.List(ctx, config.RepoOwner, config.RepoName, &opts)
// 	if err != nil {
// 		return nil, err
// 	}
// 	for _, pr := range prs {
// 		log.Printf("PR: %s %s", *pr.Title, prSubject)
// 		if *pr.Title == prSubject {
// 			return pr, nil
// 		}
// 	}
// 	return nil, nil
// }

// func (g *githubHelper) pushPR(config *Config, prSubject, prBranch, prFilename, prContent, commitMessage string) error {
// 	pr, err := getPR(config, prSubject)
// 	if err != nil {
// 		return err
// 	}
// 	if pr != nil {
// 		log.Println("Extending Existing PR", *pr.Title)
// 		ref, err := getRef(config, pr.GetHead().GetRef())
// 		if err != nil {
// 			return err
// 		}
// 		err = pushCommit(config, ref, prFilename, prContent, commitMessage)
// 		if err != nil {
// 			return err
// 		}

// 	} else {
// 		log.Println("Creating PR")
// 		ref, err := createRef(config, prBranch)
// 		if err != nil {
// 			return err
// 		}
// 		err = pushCommit(config, ref, prFilename, prContent, commitMessage)
// 		if err != nil {
// 			return err
// 		}
// 		pr, err = createPR(config, prSubject, prBranch)
// 		if err != nil {
// 			return err
// 		}
// 	}
// 	return nil
// }

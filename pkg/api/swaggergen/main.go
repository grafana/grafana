package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	. "github.com/go-git/go-git/v5/_examples"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

const (
	GF_DIR            = "grafana"
	GF_ENTERPRISE_DIR = "grafana-enterprise"
)

func getAuth(token string) *http.BasicAuth {
	if token == "" {
		return nil
	}
	return &http.BasicAuth{
		Username: "script", // yes, this can be anything except an empty string
		Password: token,
	}
}

func clone(dir, repo, branch, token string) (*git.Repository, error) {
	Info("git clone %s %s %s", repo, branch, dir)
	return git.PlainClone(dir, false, &git.CloneOptions{
		Auth:          getAuth(token),
		Depth:         1,
		Progress:      os.Stdout,
		ReferenceName: plumbing.NewBranchReferenceName(branch),
		SingleBranch:  true,
		URL:           repo,
	})
}

func execCmd(cmd *exec.Cmd) {
	o, err := cmd.CombinedOutput()
	if err != nil {
		Info(string(o))
	}
	CheckIfError(err)
}

func prepareEnv(grafanaDir, grafanaEnterpriseDir, branch, commit, token string) *git.Repository {
	var grafanaRepo *git.Repository
	grafanaRepo, err := git.PlainOpen(grafanaDir)
	CheckIfError(err)

	// check grafana branch
	h, err := grafanaRepo.Head()
	CheckIfError(err)
	if h.Name().String() != plumbing.NewBranchReferenceName(branch).String() {
		fmt.Printf("\x1b[31;1munexpected grafana branch: got:%s expected:%s\x1b[0m\n", h.Name().String(), plumbing.NewBranchReferenceName(branch).String())
		os.Exit(1)
	}

	// check latest commit
	latest, err := grafanaRepo.CommitObject(h.Hash())
	CheckIfError(err)

	if latest.Hash.String() != commit {
		fmt.Printf("\x1b[31;1munexpected commit: got:%s expected:%s\x1b[0m\n", latest.Hash.String(), commit)
		os.Exit(1)
	}

	// clone enterprise (if not exists)
	grafanaEnterpriseRepo, err := git.PlainOpen(grafanaEnterpriseDir)
	expEnterpriseBranches := []string{branch, "main"}
	if err != nil && errors.Is(err, git.ErrRepositoryNotExists) {
		for _, b := range expEnterpriseBranches {
			// checkout the specific branch if exists, otherwise checkout the main
			grafanaEnterpriseRepo, err = clone(grafanaEnterpriseDir, "https://github.com/grafana/grafana-enterprise.git", b, token)
			if err == nil {
				break
			}
		}
	}
	CheckIfError(err)

	// check grafana enterprise branch
	h, err = grafanaEnterpriseRepo.Head()
	CheckIfError(err)
	if h.Name().String() != plumbing.NewBranchReferenceName(branch).String() &&
		h.Name().String() != plumbing.NewBranchReferenceName("main").String() {
		fmt.Printf("\x1b[31;1munexpected enterprise branch: got:%s expected:%s\x1b[0m\n", h.Name().String(), strings.Join([]string{plumbing.NewBranchReferenceName(branch).String(), plumbing.NewBranchReferenceName("main").String()}, " or "))
		os.Exit(1)
	}

	Info("enable enterprise")
	//nolint:gosec
	cmd := exec.Command("/bin/sh", "dev.sh")
	cmd.Dir = grafanaEnterpriseDir
	execCmd(cmd)

	return grafanaRepo
}

func generateSwagger(grafanaDir string) {
	//regenerate OpenAPI and Swagger specs
	Info("make clean-api-spec")
	cmd := exec.Command("make", "clean-api-spec")
	cmd.Dir = grafanaDir
	execCmd(cmd)

	Info("make openapi3-gen")
	cmd = exec.Command("make", "openapi3-gen")
	cmd.Dir = grafanaDir
	execCmd(cmd)
}

func commitChanges(grafanaWorktree *git.Worktree) plumbing.Hash {
	// verify the current status
	Info("git status --porcelain")
	status, err := grafanaWorktree.Status()

	CheckIfError(err)
	files := []string{"api-spec.json", "api-merged.json", "openapi3.json"}
	hasSwaggerChanges := false
	for _, f := range files {
		fp := filepath.Join("public", f)
		fs, ok := status[fp]
		if ok && fs.Worktree == git.Modified {
			hasSwaggerChanges = true
			Info("git add %s", fp)
			_, err = grafanaWorktree.Add(fp)
			CheckIfError(err)
		}
	}

	if !hasSwaggerChanges {
		return plumbing.ZeroHash
	}

	Info("git commit -m \"Update OpenAPI and Swagger\"")
	commit, err := grafanaWorktree.Commit("Update OpenAPI and Swagger", &git.CommitOptions{
		Author: &object.Signature{
			Name:  "Grot (@grafanabot)",
			Email: "43478413+grafanabot@users.noreply.github.com",
			When:  time.Now(),
		},
	})
	CheckIfError(err)

	return commit
}

func main() {
	CheckArgs("<branch>", "<latest_commit>", "<github token>")
	branch, commit, token := os.Args[1], os.Args[2], os.Args[3]

	wd, err := os.Getwd()
	CheckIfError(err)

	parentDir := filepath.Dir(wd)
	grafanaDir := filepath.Join(parentDir, GF_DIR)
	grafanaEnterpriseDir := filepath.Join(parentDir, GF_ENTERPRISE_DIR)

	grafanaRepo := prepareEnv(grafanaDir, grafanaEnterpriseDir, branch, commit, token)

	grafanaWorktree, err := grafanaRepo.Worktree()
	CheckIfError(err)

	err = grafanaWorktree.Checkout(&git.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(branch),
	})
	CheckIfError(err)

	generateSwagger(grafanaDir)

	commitHash := commitChanges(grafanaWorktree)
	if commitHash == plumbing.ZeroHash {
		fmt.Println("Everything seems up to date!")
		os.Exit(0)
	}

	Info("git show-ref --head HEAD")
	ref, err := grafanaRepo.Head()
	CheckIfError(err)

	Info("after: %v", ref)

	Info("git push origin %s", branch)
	err = grafanaRepo.Push(&git.PushOptions{
		RefSpecs:          []config.RefSpec{config.RefSpec(fmt.Sprintf("refs/heads/%s:refs/heads/%s", branch, branch))},
		RequireRemoteRefs: []config.RefSpec{config.RefSpec(fmt.Sprintf("%s:refs/heads/%s", commit, branch))},
		Auth:              getAuth(token),
	})
	CheckIfError(err)
}

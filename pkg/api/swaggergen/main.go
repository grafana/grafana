package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/go-git/go-git/v5"
	. "github.com/go-git/go-git/v5/_examples"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

func clone(dir, repo, branch, token string) (*git.Repository, error) {
	Info("git clone %s %s %s", repo, branch, dir)
	var auth *http.BasicAuth
	if token != "" {
		auth = &http.BasicAuth{
			Username: "script", // yes, this can be anything except an empty string
			Password: token,
		}
	}
	return git.PlainClone(dir, false, &git.CloneOptions{
		Auth:          auth,
		Depth:         1,
		NoCheckout:    true,
		Progress:      os.Stdout,
		ReferenceName: plumbing.NewBranchReferenceName(branch),
		SingleBranch:  true,
		URL:           repo,
	})
}

func checkCurrentBranch(repo *git.Repository, branches ...string) {
	r, err := repo.Remotes()
	CheckIfError(err)
	Info("checking branch for repository %s", r)

	h, err := repo.Head()
	CheckIfError(err)

	for _, branch := range branches {
		if h.Name() == plumbing.ReferenceName(fmt.Sprintf("refs/heads/%s", branch)) {
			Info("grafana enterprise branch: %s", h.Name())
			return
		}
	}

	fmt.Printf("\x1b[31;1merror: unexpected current branch%s\x1b[0m\n", h.Name())
	os.Exit(1)
}

func prepareEnv(grafanaDir, grafanaEnterpriseDir, branch, token string) *git.Repository {
	var grafanaRepo *git.Repository
	grafanaRepo, err := git.PlainOpen(grafanaDir)
	if err != nil && errors.Is(err, git.ErrRepositoryNotExists) {
		// Clone the grafana repository
		grafanaRepo, err = clone(grafanaDir, "https://github.com/grafana/grafana.git", branch, "")
	}
	CheckIfError(err)

	checkCurrentBranch(grafanaRepo, branch)

	grafanaEnterpriseRepo, err := git.PlainOpen(grafanaEnterpriseDir)
	if err != nil && errors.Is(err, git.ErrRepositoryNotExists) {
		for _, b := range []string{branch, "main"} {
			// Clone the grafana enterprise repository: checkout the branch if exists otherwise checkout the main branch
			grafanaEnterpriseRepo, err = clone(grafanaEnterpriseDir, "https://github.com/grafana/grafana-enterprise.git", b, token)
			if err == nil {
				break
			}
		}
	}
	CheckIfError(err)

	checkCurrentBranch(grafanaEnterpriseRepo, branch, "main")

	Info("enable enterprise")
	//nolint:gosec
	cmd := exec.Command("/bin/sh", filepath.Join(grafanaEnterpriseDir, "dev.sh"))
	cmd.Dir = grafanaEnterpriseDir
	err = cmd.Run()
	CheckIfError(err)

	files, err := os.ReadDir(filepath.Join(grafanaDir, "pkg", "extensions"))
	CheckIfError(err)
	Info("pkg/extensions: %d", len(files))

	return grafanaRepo
}

func generateSwagger(grafanaDir string) {
	//regenerate OpenAPI and Swagger specs
	Info("make clean-api-spec")
	cmd := exec.Command("make", "clean-api-spec")
	cmd.Dir = grafanaDir
	err := cmd.Run()
	CheckIfError(err)

	Info("make openapi3-gen")
	cmd = exec.Command("make", "openapi3-gen")
	cmd.Dir = grafanaDir
	err = cmd.Run()
	CheckIfError(err)
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
	CheckArgs("<grafana_subdir>", "<branch>", "<github token>")
	grafanaSubDir, branch, token := os.Args[1], os.Args[2], os.Args[3]

	grafanaSubDir = filepath.Clean(grafanaSubDir)

	wd, err := os.Getwd()
	CheckIfError(err)

	parentDir := filepath.Dir(wd)
	grafanaDir := filepath.Join(parentDir, grafanaSubDir)
	grafanaEnterpriseDir := filepath.Join(parentDir, "grafana-enterprise")

	fmt.Println(">>>", grafanaDir, grafanaEnterpriseDir, branch)

	grafanaRepo := prepareEnv(grafanaDir, grafanaEnterpriseDir, branch, token)

	generateSwagger(grafanaDir)

	grafanaWorktree, err := grafanaRepo.Worktree()
	CheckIfError(err)

	commitHash := commitChanges(grafanaWorktree)
	if commitHash == plumbing.ZeroHash {
		fmt.Println("Everything seems up to date!")
		os.Exit(0)
	}

	Info("git show -s")
	obj, err := grafanaRepo.CommitObject(commitHash)
	CheckIfError(err)

	fmt.Println(obj)

	/*
		Info("git push origin %s", branch)
		// push changes
		refSpec := config.RefSpec(fmt.Sprintf("refs/heads/%s:refs/remotes/origin/%s", branch, branch))

		err = grafanaRepo.Push(&git.PushOptions{
			RefSpecs:          []config.RefSpec{refSpec},
			RequireRemoteRefs: []config.RefSpec{refSpec},
		})
		CheckIfError(err)
	*/
}

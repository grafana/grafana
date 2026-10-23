package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-github/v82/github"
	"github.com/grafana/nanogit/gittest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/webhooksuite"
)

func TestIntegrationProvisioning_GithubWebhook(t *testing.T) {
	webhooksuite.Run(t, func(t *testing.T) *common.GitTestHelper {
		helper := env.GetCleanHelper(t)
		helper.GetEnv().GithubRepoFactory.Client = &http.Client{Transport: githubFake}
		return helper
	}, githubFake)
}

var githubFake = &fakeGithub{repos: map[string]*githubRepo{}, nextID: 1000}

type githubRepo struct {
	id          int64
	hook        *github.Hook
	hookCreates int
	comments    []string
}

type fakeGithub struct {
	mu     sync.Mutex
	repos  map[string]*githubRepo
	nextID int64
}

func (f *fakeGithub) Name() string { return "github" }

func (f *fakeGithub) CreateRepo(t *testing.T, helper *common.GitTestHelper, repoName string, files map[string][]byte, opts webhooksuite.RepoOptions) *gittest.LocalRepo {
	t.Helper()
	user := helper.GithubTransportUser(t)
	remote, local := helper.CreateRemoteGitRepo(t, repoName, user, files)

	f.mu.Lock()
	f.nextID++
	f.repos[repoName] = &githubRepo{id: f.nextID}
	f.mu.Unlock()

	webhooksuite.CreateRepository(t, helper, repoName, provisioning.GitHubRepositoryType, map[string]any{
		"url":    remote.URL,
		"branch": "main",
	}, user.Password, opts)
	return local
}

func (f *fakeGithub) repo(repoName string) *githubRepo {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.repos[repoName]
}

func (f *fakeGithub) HookID(repoName string) repository.WebhookID {
	return repository.WebhookID{ID: f.repo(repoName).id}
}

func (f *fakeGithub) HookCreates(repoName string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.repos[repoName].hookCreates
}

func (f *fakeGithub) Comments(repoName string) []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.repos[repoName].comments...)
}

func (f *fakeGithub) PushEvent(repoName string, commits [][]string) (http.Header, []byte) {
	var listed []any
	for _, added := range commits {
		listed = append(listed, map[string]any{"added": added})
	}
	header := http.Header{}
	header.Set(github.EventTypeHeader, "push")
	header.Set(github.DeliveryIDHeader, repoName+"-push")
	return header, webhooksuite.MustJSON(map[string]any{
		"ref":        "refs/heads/main",
		"repository": map[string]any{"full_name": "git/" + repoName},
		"sender":     map[string]any{"login": "tester", "id": 1},
		"commits":    listed,
	})
}

func (f *fakeGithub) PullRequestEvent(repoName string, number int, branch, sha string) (http.Header, []byte) {
	header := http.Header{}
	header.Set(github.EventTypeHeader, "pull_request")
	header.Set(github.DeliveryIDHeader, repoName+"-pull-request")
	return header, webhooksuite.MustJSON(map[string]any{
		"action":     "opened",
		"repository": map[string]any{"full_name": "git/" + repoName},
		"sender":     map[string]any{"login": "tester", "id": 1},
		"pull_request": map[string]any{
			"number":   number,
			"html_url": fmt.Sprintf("https://github.example.com/git/%s/pull/%d", repoName, number),
			"base":     map[string]any{"ref": "main", "repo": map[string]any{"id": 1}},
			"head":     map[string]any{"ref": branch, "sha": sha, "repo": map[string]any{"id": 1}},
		},
	})
}

func (f *fakeGithub) Sign(header http.Header, secret string, body []byte) {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	header.Set(github.SHA256SignatureHeader, "sha256="+hex.EncodeToString(mac.Sum(nil)))
}

func (f *fakeGithub) RoundTrip(r *http.Request) (*http.Response, error) {
	rec := httptest.NewRecorder()
	f.serveAPI(rec, r)
	resp := rec.Result()
	resp.Request = r
	return resp, nil
}

func (f *fakeGithub) serveAPI(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/repos/"), "/", 3)
	if len(parts) < 3 || parts[0] != "git" || f.repos[parts[1]] == nil {
		webhooksuite.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
		return
	}
	repo, sub := f.repos[parts[1]], parts[2]

	hookPath := fmt.Sprintf("hooks/%d", repo.id)
	switch {
	case strings.HasPrefix(sub, "branches/") && strings.HasSuffix(sub, "/protection"):
		webhooksuite.WriteJSON(w, http.StatusForbidden, map[string]any{"message": "Forbidden"})
	case strings.HasPrefix(sub, "rules/branches/"):
		webhooksuite.WriteJSON(w, http.StatusOK, []any{})
	case sub == "hooks" && r.Method == http.MethodPost:
		hook := &github.Hook{}
		_ = json.NewDecoder(r.Body).Decode(hook)
		hook.ID = new(repo.id)
		hook.Active = new(true)
		repo.hook = hook
		repo.hookCreates++
		webhooksuite.WriteJSON(w, http.StatusCreated, hook)
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodGet:
		webhooksuite.WriteJSON(w, http.StatusOK, repo.hook)
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodPatch:
		_ = json.NewDecoder(r.Body).Decode(repo.hook)
		webhooksuite.WriteJSON(w, http.StatusOK, repo.hook)
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodDelete:
		repo.hook = nil
		w.WriteHeader(http.StatusNoContent)
	case strings.HasPrefix(sub, "issues/") && strings.HasSuffix(sub, "/comments") && r.Method == http.MethodPost:
		var comment github.IssueComment
		_ = json.NewDecoder(r.Body).Decode(&comment)
		repo.comments = append(repo.comments, comment.GetBody())
		webhooksuite.WriteJSON(w, http.StatusCreated, &github.IssueComment{ID: new(int64(1)), Body: new(comment.GetBody())})
	default:
		webhooksuite.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
	}
}

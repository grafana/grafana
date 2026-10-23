package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-github/v82/github"
	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/webhooksuite"
)

func TestIntegrationProvisioning_GithubWebhook(t *testing.T) {
	webhooksuite.Run(t, githubHelper, githubMock)
}

func TestIntegrationProvisioning_GithubWebhookPing(t *testing.T) {
	helper := githubHelper(t)
	repoName := "github-webhook-ping"
	githubMock.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("ping-dash", "Ping Dashboard", 1),
	}, webhooksuite.RepoOptions{})
	webhooksuite.WaitForWebhook(t, helper, repoName, githubMock.HookID(repoName))

	header := http.Header{}
	header.Set(github.EventTypeHeader, "ping")
	header.Set(github.DeliveryIDHeader, repoName+"-ping")
	code, job := webhooksuite.DeliverWebhook(t, helper, githubMock, repoName, header, common.AsJSON(map[string]any{
		"zen":        "Keep it logically awesome.",
		"repository": map[string]any{"full_name": "git/" + repoName},
	}))
	require.Equal(t, http.StatusOK, code, "a ping must be acknowledged")
	require.Nil(t, job, "a ping must not queue a job")
}

func githubHelper(t *testing.T) *common.GitTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = &http.Client{Transport: githubMock}
	return helper
}

var githubMock = &mockGithub{repos: map[string]*githubRepo{}, nextID: 1000}

type githubRepo struct {
	webhooksuite.State
	id   int64
	hook *github.Hook
	opts webhooksuite.RepoOptions
}

type mockGithub struct {
	mu     sync.Mutex
	repos  map[string]*githubRepo
	nextID int64
}

func (f *mockGithub) Name() string { return "github" }

func (f *mockGithub) CreateRepo(t *testing.T, helper *common.GitTestHelper, repoName string, files map[string][]byte, opts webhooksuite.RepoOptions) *gittest.LocalRepo {
	t.Helper()
	user := helper.GithubTransportUser(t)
	remote, local := helper.CreateRemoteGitRepo(t, repoName, user, files)

	f.mu.Lock()
	f.nextID++
	f.repos[repoName] = &githubRepo{id: f.nextID, opts: opts}
	f.mu.Unlock()

	webhooksuite.CreateRepository(t, helper, repoName, provisioning.GitHubRepositoryType, map[string]any{
		"url":    remote.URL,
		"branch": "main",
	}, user.Password, opts)
	return local
}

func (f *mockGithub) HookID(repoName string) repository.WebhookID {
	f.mu.Lock()
	defer f.mu.Unlock()
	return repository.WebhookID{ID: f.repos[repoName].id}
}

func (f *mockGithub) State(repoName string) webhooksuite.State {
	f.mu.Lock()
	defer f.mu.Unlock()
	state := f.repos[repoName].State
	state.Comments = append([]string(nil), state.Comments...)
	return state
}

func (f *mockGithub) Event(repoName string, e webhooksuite.Event) (http.Header, []byte) {
	switch {
	case e.Kind == webhooksuite.PushEvent:
		return githubPushEvent("git/"+repoName, "refs/heads/main", e.Commits)
	case e.Kind == webhooksuite.PullRequestEvent && e.ForkURL != "":
		return githubPullRequestEvent(repoName, "opened", "main", e.Number, e.Branch, e.SHA, map[string]any{"id": 2, "html_url": e.ForkURL})
	case e.Kind == webhooksuite.PullRequestEvent:
		return githubPullRequestEvent(repoName, "opened", "main", e.Number, e.Branch, e.SHA, map[string]any{"id": 1})
	default:
		header := http.Header{}
		header.Set(github.EventTypeHeader, "issues")
		header.Set(github.DeliveryIDHeader, repoName+"-issues")
		return header, common.AsJSON(map[string]any{"action": "opened", "repository": map[string]any{"full_name": "git/" + repoName}})
	}
}

func githubPushEvent(fullName, ref string, commits [][]string) (http.Header, []byte) {
	listed := make([]any, 0, len(commits))
	for _, added := range commits {
		listed = append(listed, map[string]any{"added": added})
	}
	header := http.Header{}
	header.Set(github.EventTypeHeader, "push")
	header.Set(github.DeliveryIDHeader, fullName+"-"+ref)
	return header, common.AsJSON(map[string]any{
		"ref":        ref,
		"repository": map[string]any{"full_name": fullName},
		"sender":     map[string]any{"login": "tester", "id": 1},
		"commits":    listed,
	})
}

func githubPullRequestEvent(repoName, action, base string, number int, branch, sha string, headRepo map[string]any) (http.Header, []byte) {
	header := http.Header{}
	header.Set(github.EventTypeHeader, "pull_request")
	header.Set(github.DeliveryIDHeader, fmt.Sprintf("%s-pull-request-%s", repoName, sha))
	return header, common.AsJSON(map[string]any{
		"action":     action,
		"repository": map[string]any{"full_name": "git/" + repoName},
		"sender":     map[string]any{"login": "tester", "id": 1},
		"pull_request": map[string]any{
			"number":   number,
			"html_url": fmt.Sprintf("https://github.example.com/git/%s/pull/%d", repoName, number),
			"base":     map[string]any{"ref": base, "repo": map[string]any{"id": 1}},
			"head":     map[string]any{"ref": branch, "sha": sha, "repo": headRepo},
		},
	})
}

func (f *mockGithub) RemoveHook(repoName string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.repos[repoName].hook = nil
}

func (f *mockGithub) Sign(header http.Header, secret string, body []byte) {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	header.Set(github.SHA256SignatureHeader, "sha256="+hex.EncodeToString(mac.Sum(nil)))
}

func (f *mockGithub) RoundTrip(r *http.Request) (*http.Response, error) {
	return common.ServeRecorded(r, f.serveAPI), nil
}

func (f *mockGithub) serveAPI(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/repos/"), "/", 3)
	if len(parts) < 3 || parts[0] != "git" || f.repos[parts[1]] == nil {
		common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
		return
	}
	repo, sub := f.repos[parts[1]], parts[2]

	switch {
	case strings.HasPrefix(sub, "branches/") && strings.HasSuffix(sub, "/protection"):
		common.WriteJSON(w, http.StatusForbidden, map[string]any{"message": "Forbidden"})
	case strings.HasPrefix(sub, "rules/branches/"):
		common.WriteJSON(w, http.StatusOK, []any{})
	case sub == "hooks" || strings.HasPrefix(sub, "hooks/"):
		f.serveHooks(w, r, repo, sub)
	case strings.HasPrefix(sub, "compare/"):
		repo.MergeBaseCalls++
		common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
	case strings.HasPrefix(sub, "issues/"):
		f.serveComments(w, r, repo, sub)
	default:
		common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
	}
}

func (f *mockGithub) serveComments(w http.ResponseWriter, r *http.Request, repo *githubRepo, sub string) {
	switch {
	case strings.HasPrefix(sub, "issues/") && strings.HasSuffix(sub, "/comments") && r.Method == http.MethodPost:
		var comment github.IssueComment
		_ = json.NewDecoder(r.Body).Decode(&comment)
		repo.Comments = append(repo.Comments, comment.GetBody())
		common.WriteJSON(w, http.StatusCreated, &github.IssueComment{ID: new(int64(len(repo.Comments))), Body: new(comment.GetBody())})
	case strings.HasPrefix(sub, "issues/") && strings.HasSuffix(sub, "/comments") && r.Method == http.MethodGet:
		list := make([]*github.IssueComment, 0, len(repo.Comments))
		for i, body := range repo.Comments {
			list = append(list, &github.IssueComment{ID: new(int64(i + 1)), Body: new(body)})
		}
		common.WriteJSON(w, http.StatusOK, list)
	case strings.HasPrefix(sub, "issues/comments/") && r.Method == http.MethodPatch:
		id, err := strconv.Atoi(strings.TrimPrefix(sub, "issues/comments/"))
		if err != nil || id < 1 || id > len(repo.Comments) {
			common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
			return
		}
		var comment github.IssueComment
		_ = json.NewDecoder(r.Body).Decode(&comment)
		repo.Comments[id-1] = comment.GetBody()
		common.WriteJSON(w, http.StatusOK, &github.IssueComment{ID: new(int64(id)), Body: new(comment.GetBody())})
	default:
		common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
	}
}

func (f *mockGithub) serveHooks(w http.ResponseWriter, r *http.Request, repo *githubRepo, sub string) {
	hookPath := fmt.Sprintf("hooks/%d", repo.id)
	switch {
	case sub == "hooks" && r.Method == http.MethodPost && repo.opts.HookCreateFails:
		repo.HookCreates++
		common.WriteJSON(w, http.StatusInternalServerError, map[string]any{"message": "failed to create webhook"})
	case sub == "hooks" && r.Method == http.MethodPost && repo.hook != nil:
		repo.HookCreates++
		common.WriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"message": "Validation Failed",
			"errors":  []map[string]any{{"resource": "Hook", "code": "custom", "message": "Hook already exists on this repository"}},
		})
	case sub == "hooks" && r.Method == http.MethodGet:
		hooks := []*github.Hook{}
		if repo.hook != nil {
			hooks = append(hooks, repo.hook)
		}
		common.WriteJSON(w, http.StatusOK, hooks)
	case sub == "hooks" && r.Method == http.MethodPost:
		hook := &github.Hook{}
		_ = json.NewDecoder(r.Body).Decode(hook)
		repo.HookSecret = hook.GetConfig().GetSecret()
		hook.ID = new(repo.id)
		hook.Active = new(true)
		repo.hook = hook
		repo.HookCreates++
		common.WriteJSON(w, http.StatusCreated, hook)
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodGet:
		common.WriteJSON(w, http.StatusOK, repo.hook)
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodPatch:
		_ = json.NewDecoder(r.Body).Decode(repo.hook)
		repo.hook.ID = new(repo.id)
		repo.HookSecret = repo.hook.GetConfig().GetSecret()
		common.WriteJSON(w, http.StatusOK, repo.hook)
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodDelete && repo.opts.HookDeleteStatus != 0:
		repo.HookDeletes++
		common.WriteJSON(w, repo.opts.HookDeleteStatus, map[string]any{"message": http.StatusText(repo.opts.HookDeleteStatus)})
	case sub == hookPath && repo.hook != nil && r.Method == http.MethodDelete:
		repo.HookDeletes++
		repo.hook = nil
		w.WriteHeader(http.StatusNoContent)
	default:
		common.WriteJSON(w, http.StatusNotFound, map[string]any{"message": "Not Found"})
	}
}

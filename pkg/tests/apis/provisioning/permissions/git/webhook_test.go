package git

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/google/go-github/v82/github"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// A None identity does not replace provider signature verification. Invalid signatures
// must create no job or provider comment, while signed events exercise the worker flow.
// Anonymous requests separately characterize the version-specific authentication exception.
func TestIntegrationProvisioning_NoneWebhook(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.Name()
	base := "https://grafana.example.com"
	hook := &github.Hook{ID: github.Ptr(int64(654)), Active: github.Ptr(true), Events: []string{"pull_request", "push"}, Config: &github.HookConfig{URL: github.Ptr(base + pt.Path("v0alpha1", "repositories/"+repo+"/webhook"))}}
	encode := func(value any) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			require.NoError(t, json.NewEncoder(w).Encode(value))
		}
	}
	var comments atomic.Int32
	h.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(403) })),
		ghmock.WithRequestMatchHandler(ghmock.GetReposRulesBranchesByOwnerByRepoByBranch, encode([]*github.RepositoryRule{})),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepo, encode([]*github.Hook{hook})),
		ghmock.WithRequestMatchHandler(ghmock.PostReposHooksByOwnerByRepo, encode(hook)),
		ghmock.WithRequestMatchHandler(ghmock.GetReposHooksByOwnerByRepoByHookId, encode(hook)),
		ghmock.WithRequestMatchHandler(ghmock.DeleteReposHooksByOwnerByRepoByHookId, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })),
		ghmock.WithRequestMatchHandler(ghmock.PostReposIssuesCommentsByOwnerByRepoByIssueNumber, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var comment github.IssueComment
			if err := json.NewDecoder(r.Body).Decode(&comment); err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			comments.Add(1)
			encode(&github.IssueComment{ID: github.Ptr(int64(1)), Body: comment.Body})(w, r)
		})),
	)
	uid := pt.Name()
	_, local := h.CreateGithubRepo(t, repo, map[string][]byte{"dashboard.json": common.DashboardJSON(uid, "Webhook dashboard", 1)}, base, "write", "branch")
	h.SyncAndWait(t, repo)
	_, err := local.Git("checkout", "-b", "feature")
	require.NoError(t, err)
	require.NoError(t, local.UpdateFile("dashboard.json", string(common.DashboardJSON(uid, "Webhook updated", 2))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "Webhook update")
	require.NoError(t, err)
	sha, err := local.Git("rev-parse", "HEAD")
	require.NoError(t, err)
	_, err = local.Git("push", "origin", "feature")
	require.NoError(t, err)
	obj, err := h.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
	require.NoError(t, err)
	configured := common.MustFromUnstructured[provisioning.Repository](t, obj)
	secretName := configured.Secure.WebhookSecret.Name
	require.NotEmpty(t, secretName)
	decrypted, err := h.GetEnv().DecryptService.Decrypt(t.Context(), provisioning.GROUP, h.Namespace, secretName)
	require.NoError(t, err)
	result := decrypted[secretName]
	require.NoError(t, result.Error())
	secret := result.Value().DangerouslyExposeAndConsumeValue()
	payload := pt.JSON(t, map[string]any{"action": "opened", "repository": map[string]any{"full_name": "git/" + repo}, "pull_request": map[string]any{"number": 123, "html_url": "https://github.example.com/git/" + repo + "/pull/123", "base": map[string]any{"ref": "main"}, "head": map[string]any{"ref": "feature", "sha": strings.TrimSpace(sha)}}})
	u := pt.None(t, h.ProvisioningTestHelper)
	for _, version := range pt.Versions {
		for _, auth := range []string{"missing", "invalid", "valid", "anonymous"} {
			t.Run(version+"/"+auth, func(t *testing.T) {
				active, err := h.Jobs.Resource.List(t.Context(), metav1.ListOptions{})
				require.NoError(t, err)
				history := pt.Do(t, h.Org1.Admin, "GET", version, "historicjobs", nil).Require(t, 200).Object(t)
				before := len(active.Items) + len(history["items"].([]any))
				beforeComments := comments.Load()
				var event map[string]any
				require.NoError(t, json.Unmarshal(payload, &event))
				event["pull_request"].(map[string]any)["number"] = int(beforeComments) + 123
				requestBody := pt.JSON(t, event)
				requestMAC := hmac.New(sha256.New, []byte(secret))
				_, err = requestMAC.Write(requestBody)
				require.NoError(t, err)
				requestSignature := "sha256=" + hex.EncodeToString(requestMAC.Sum(nil))
				cfg := u.NewRestConfig()
				req, err := http.NewRequestWithContext(t.Context(), "POST", cfg.Host+pt.Path(version, "repositories/"+repo+"/webhook"), bytes.NewReader(requestBody))
				require.NoError(t, err)
				if auth != "anonymous" {
					req.SetBasicAuth(cfg.Username, cfg.Password)
				}
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set(github.EventTypeHeader, "pull_request")
				req.Header.Set(github.DeliveryIDHeader, pt.Name())
				if auth == "valid" || auth == "anonymous" {
					req.Header.Set(github.SHA256SignatureHeader, requestSignature)
				}
				if auth == "invalid" {
					req.Header.Set(github.SHA256SignatureHeader, "sha256="+strings.Repeat("0", 64))
				}
				res, err := http.DefaultClient.Do(req)
				require.NoError(t, err)
				defer res.Body.Close()
				data, err := io.ReadAll(res.Body)
				require.NoError(t, err)
				rsp := pt.Response{Code: res.StatusCode, Body: data}
				if auth == "valid" || auth == "anonymous" && version == "v0alpha1" {
					rsp.Require(t, 202)
					h.AwaitJobSuccess(t, &unstructured.Unstructured{Object: rsp.Object(t)})
					require.Equal(t, beforeComments+1, comments.Load())
				} else {
					require.Equal(t, 401, rsp.Code, string(rsp.Body))
					active, err = h.Jobs.Resource.List(t.Context(), metav1.ListOptions{})
					require.NoError(t, err)
					history = pt.Do(t, h.Org1.Admin, "GET", version, "historicjobs", nil).Require(t, 200).Object(t)
					require.Equal(t, before, len(active.Items)+len(history["items"].([]any)))
					require.Equal(t, beforeComments, comments.Load())
				}
			})
		}
	}
}

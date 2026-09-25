package git

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	pt "github.com/grafana/grafana/pkg/tests/apis/provisioning/permissions/testutil"
)

// Branch listing supports either job creation or repository management, whereas both
// history routes require repository write. Read-only repository access supplies neither.
func TestIntegrationProvisioning_NoneRefsAndHistory(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.Name()
	h.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(403) })),
		ghmock.WithRequestMatch(ghmock.GetReposRulesBranchesByOwnerByRepoByBranch, []*github.RepositoryRule{}),
		ghmock.WithRequestMatchHandler(ghmock.GetReposCommitsByOwnerByRepo, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]*github.RepositoryCommit{{SHA: github.Ptr("audit-commit"), Commit: &github.Commit{Message: github.Ptr("Fixture commit"), Author: &github.CommitAuthor{Name: github.Ptr("Fixture"), Date: &github.Timestamp{Time: time.Now()}}, Committer: &github.CommitAuthor{Name: github.Ptr("Fixture"), Date: &github.Timestamp{Time: time.Now()}}}}})
		})),
	)
	h.CreateGithubRepoWithWebhookDisabled(t, repo, map[string][]byte{"dashboard.json": common.DashboardJSON(pt.Name(), "History", 1)}, "write", "branch")
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "read", "write", "jobs"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				var actions []string
				switch grant {
				case "read", "write":
					actions = []string{"provisioning.repositories:" + grant}
				case "jobs":
					actions = []string{"provisioning.jobs:create"}
				}
				u := pt.None(t, h.ProvisioningTestHelper, pt.Actions(actions...)...)
				for _, sub := range []string{"refs", "history/", "history/dashboard.json"} {
					rsp := pt.Do(t, u, "GET", version, "repositories/"+repo+"/"+sub, nil)
					if grant == "write" || (grant == "jobs" && sub == "refs") {
						rsp.Require(t, 200)
						require.NotEmpty(t, rsp.Body)
						if strings.HasPrefix(sub, "history") {
							require.Contains(t, string(rsp.Body), "Fixture commit")
						}
					} else {
						rsp.Require(t, 403)
					}
				}
			})
		}
	}
}

// Branch-only dashboards use resource grants without provisioning management access.
// Verify remote bytes and their absence from Grafana; denial must not create a branch.
func TestIntegrationProvisioning_NoneBranchResourceWrites(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.Name()
	_, local := h.CreateSyncEnabledGitRepo(t, repo, nil, "write", "branch")
	for _, version := range pt.Versions {
		for _, grant := range []string{"none", "repository", "resource"} {
			t.Run(version+"/"+grant, func(t *testing.T) {
				uid := pt.Name()
				branch := pt.Name()
				file := uid + ".json"
				var actions []string
				if grant == "repository" {
					actions = []string{"provisioning.repositories:write"}
				}
				if grant == "resource" {
					actions = []string{"dashboards:create", "dashboards:read", "dashboards:write", "dashboards:delete"}
				}
				u := pt.None(t, h.ProvisioningTestHelper, pt.Actions(actions...)...)
				rsp := pt.Do(t, u, "POST", version, "repositories/"+repo+"/files/"+file+"?ref="+branch+"&message=Permission+audit", pt.Dashboard(uid, "Branch dashboard"))
				if grant != "resource" {
					rsp.Require(t, 403)
					refs, err := local.Git("ls-remote", "origin", "refs/heads/"+branch)
					require.NoError(t, err)
					require.Empty(t, strings.TrimSpace(refs))
					return
				}
				rsp.Require(t, 200)
				_, err := local.Git("fetch", "origin")
				require.NoError(t, err)
				data, err := local.Git("show", "origin/"+branch+":"+file)
				require.NoError(t, err)
				require.Contains(t, data, "Branch dashboard")
				_, err = h.DashboardsV0.Resource.Get(t.Context(), uid, metav1.GetOptions{})
				require.True(t, apierrors.IsNotFound(err))
				pt.Do(t, u, "GET", version, "repositories/"+repo+"/files/"+file+"?ref="+branch+"&message=Permission+audit", nil).Require(t, 200)
				pt.Do(t, u, "PUT", version, "repositories/"+repo+"/files/"+file+"?ref="+branch+"&message=Permission+audit", pt.Dashboard(uid, "Updated branch dashboard")).Require(t, 200)
				_, err = local.Git("fetch", "origin")
				require.NoError(t, err)
				data, err = local.Git("show", "origin/"+branch+":"+file)
				require.NoError(t, err)
				require.Contains(t, data, "Updated branch dashboard")
			})
		}
	}
}

// Feature branches permit directory operations unavailable on the synced branch.
// Separate source and destination grants, then inspect remote changes while preserving
// the folder provisioned from the configured branch.
func TestIntegrationProvisioning_NoneBranchFolderOperations(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.Name()
	source, target := pt.Name(), pt.Name()
	_, local := h.CreateFolderTargetGitRepo(t, repo, map[string][]byte{"source/_folder.json": pt.JSON(t, pt.Folder(source, "Source")), "source/dashboard.json": common.DashboardJSON(pt.Name(), "Contents", 1), "target/_folder.json": pt.JSON(t, pt.Folder(target, "Target"))}, "write", "branch")
	h.SyncAndWait(t, repo)
	for _, version := range pt.Versions {
		for _, operation := range []string{"move", "delete"} {
			for _, grant := range []string{"none", "source", "target", "both"} {
				t.Run(version+"/"+operation+"/"+grant, func(t *testing.T) {
					var actions []string
					if grant == "source" || grant == "both" {
						if operation == "delete" {
							actions = append(actions, "folders:delete")
						} else {
							actions = append(actions, "folders:write")
						}
					}
					if grant == "target" || grant == "both" {
						actions = append(actions, "folders:create")
					}
					u := pt.None(t, h.ProvisioningTestHelper, pt.Actions(actions...)...)
					branch := pt.Name()
					method := "POST"
					path := "target/moved/?originalPath=source/&ref=" + branch
					if operation == "delete" {
						method = "DELETE"
						path = "source/?ref=" + branch
					}
					rsp := pt.Do(t, u, method, version, "repositories/"+repo+"/files/"+path+"&message=Permission+audit", nil)
					allowed := grant == "both" || (operation == "delete" && grant == "source")
					if !allowed {
						rsp.Require(t, 403)
						refs, err := local.Git("ls-remote", "origin", "refs/heads/"+branch)
						require.NoError(t, err)
						require.Empty(t, strings.TrimSpace(refs))
						return
					}
					rsp.Require(t, 200)
					_, err := local.Git("fetch", "origin")
					require.NoError(t, err)
					_, err = local.Git("show", "origin/"+branch+":source/dashboard.json")
					require.Error(t, err)
					if operation == "move" {
						content, err := local.Git("show", "origin/"+branch+":target/moved/dashboard.json")
						require.NoError(t, err)
						require.Contains(t, content, "Contents")
					}
					_, err = h.Folders.Resource.Get(t.Context(), source, metav1.GetOptions{})
					require.NoError(t, err)
				})
			}
		}
	}
}

// Raw-file authorization resolves folder identity from the configured branch.
// Substituting an accessible folder UID on a feature branch must not expose private files.
func TestIntegrationProvisioning_NoneBranchMetadataBoundary(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.Name()
	restricted, granted := pt.Name(), pt.Name()
	_, local := h.CreateFolderTargetGitRepo(t, repo, map[string][]byte{"private/_folder.json": pt.JSON(t, pt.Folder(restricted, "Private")), "private/README.md": []byte("Private content"), "granted/_folder.json": pt.JSON(t, pt.Folder(granted, "Granted"))}, "write", "branch")
	h.SyncAndWait(t, repo)
	_, err := local.Git("checkout", "-b", "spoofed")
	require.NoError(t, err)
	require.NoError(t, local.UpdateFile("private/_folder.json", string(pt.JSON(t, pt.Folder(granted, "Spoofed")))))
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "Change branch folder metadata")
	require.NoError(t, err)
	_, err = local.Git("push", "origin", "spoofed")
	require.NoError(t, err)
	u := pt.None(t, h.ProvisioningTestHelper, pt.Grant("folders", granted, "folders:read"))
	for _, version := range pt.Versions {
		pt.Do(t, u, "GET", version, "repositories/"+repo+"/files/private/README.md?ref=spoofed", nil).Require(t, 403)
	}
	u = pt.None(t, h.ProvisioningTestHelper, pt.Grant("folders", restricted, "folders:read"))
	pt.Do(t, u, "GET", "v0alpha1", "repositories/"+repo+"/files/private/README.md?ref=spoofed", nil).Require(t, 200)
}

// Dashboard-create permission cannot replace the workflow allowed for the chosen ref.
// Empty and configured refs need write; feature refs need branch, with commits checked remotely.
func TestIntegrationProvisioning_NoneGitWorkflowRestrictions(t *testing.T) {
	h := sharedHelper(t)
	repo := pt.Name()
	_, local := h.CreateFolderTargetGitRepo(t, repo, nil, "write", "branch")
	u := pt.None(t, h.ProvisioningTestHelper, pt.Actions("dashboards:create")...)
	for _, workflows := range [][]string{{}, {"write"}, {"branch"}, {"write", "branch"}} {
		for _, ref := range []string{"", "main", "feature"} {
			t.Run(strings.Join(workflows, "+")+"/"+ref, func(t *testing.T) {
				pt.Do(t, h.Org1.Admin, "PATCH", "v0alpha1", "repositories/"+repo, map[string]any{"spec": map[string]any{"workflows": workflows}}).Require(t, 200)
				h.WaitForHealthyRepository(t, repo)
				uid := pt.Name()
				branch := ref
				if ref == "feature" {
					branch = pt.Name()
				}
				rsp := pt.Do(t, u, "POST", "v0alpha1", "repositories/"+repo+"/files/"+uid+".json?ref="+branch, pt.Dashboard(uid, "Workflow"))
				allowed := false
				for _, w := range workflows {
					if ref == "feature" && w == "branch" || ref != "feature" && w == "write" {
						allowed = true
					}
				}
				if !allowed {
					rsp.Require(t, 403)
					return
				}
				rsp.Require(t, 200)
				_, err := local.Git("fetch", "origin")
				require.NoError(t, err)
				if branch == "" {
					branch = "main"
				}
				_, err = local.Git("show", "origin/"+branch+":"+uid+".json")
				require.NoError(t, err)
			})
		}
	}
}

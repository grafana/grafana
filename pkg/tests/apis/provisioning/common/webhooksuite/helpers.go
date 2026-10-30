package webhooksuite

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

type Provider interface {
	Name() string
	CreateRepo(t *testing.T, helper *common.GitTestHelper, repoName string, files map[string][]byte, opts RepoOptions) *gittest.LocalRepo
	HookID(repoName string) repository.WebhookID
	State(repoName string) State
	Event(repoName string, e Event) (http.Header, []byte)
	Sign(header http.Header, secret string, body []byte)
	RemoveHook(repoName string)
}

type RepoOptions struct {
	WebhookDisabled  bool
	SyncEnabled      bool
	HookCreateFails  bool
	HookDeleteStatus int
}

type State struct {
	HookCreates    int
	HookDeletes    int
	HookSecret     string
	MergeBaseCalls int
	Comments       []string
}

type EventKind int

const (
	PushEvent EventKind = iota
	PullRequestEvent
	UnsupportedEvent
)

type Event struct {
	Kind    EventKind
	Commits [][]string
	Number  int
	Branch  string
	SHA     string
	ForkURL string
}

const (
	WebhookBaseURL        = "https://grafana.example.com"
	MaxIncrementalChanges = 25
)

func EnvOptions() []common.GrafanaOption {
	return []common.GrafanaOption{
		common.WithoutProvisioningFolderMetadata,
		common.WithProvisioningPublicRootURL(WebhookBaseURL),
		common.WithProvisioningMaxIncrementalChanges(MaxIncrementalChanges),
	}
}

func CreateRemote(t *testing.T, helper *common.GitTestHelper, repoName string, files map[string][]byte) (*gittest.User, *gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()
	user, err := helper.GitServer().CreateUser(t.Context())
	require.NoError(t, err, "failed to create git user")
	remote, local := helper.CreateRemoteGitRepo(t, repoName, user, files)
	return user, remote, local
}

func CreateRepository(t *testing.T, helper *common.GitTestHelper, repoName string, repoType provisioning.RepositoryType, config map[string]any, token string, opts RepoOptions) {
	t.Helper()

	webhook := map[string]any{"baseUrl": WebhookBaseURL}
	if opts.WebhookDisabled {
		webhook = map[string]any{"disabled": true}
	}
	_, err := helper.Repositories.Resource.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": provisioning.APIVERSION,
		"kind":       "Repository",
		"metadata":   map[string]any{"name": repoName, "namespace": helper.Namespace},
		"spec": map[string]any{
			"title":          repoName,
			"type":           string(repoType),
			string(repoType): config,
			"sync": map[string]any{
				"enabled":         opts.SyncEnabled,
				"target":          "instance",
				"intervalSeconds": 60,
			},
			"workflows": []any{"write"},
			"webhook":   webhook,
		},
		"secure": map[string]any{
			"token": map[string]any{"create": token},
		},
	}}, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create repository")
	if !opts.HookCreateFails {
		helper.WaitForHealthyRepository(t, repoName)
	}
}

func ExpectedWebhookURL(namespace, repoName string) string {
	gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
	return fmt.Sprintf("%s/apis/%s/%s/namespaces/%s/%s/%s/webhook",
		strings.TrimRight(WebhookBaseURL, "/"), gvr.Group, gvr.Version, namespace, gvr.Resource, repoName)
}

func GetRepository(t *testing.T, helper *common.GitTestHelper, repoName string) *provisioning.Repository {
	t.Helper()
	obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err, "failed to read repository")
	return common.MustFromUnstructured[provisioning.Repository](t, obj)
}

func WaitForWebhook(t *testing.T, helper *common.GitTestHelper, repoName string, expected repository.WebhookID) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(collect, err)
		repo, err := common.FromUnstructured[provisioning.Repository](obj)
		if !assert.NoError(collect, err) {
			return
		}
		require.NotNil(collect, repo.Status.Webhook, "webhook should be set")
		require.NotEmpty(collect, repo.Secure.WebhookSecret.Name, "webhook secret should be created")
		require.Equal(collect, expected, repository.GetID(repo.Status.Webhook))
		require.Equal(collect, ExpectedWebhookURL(helper.Namespace, repoName), repo.Status.Webhook.URL)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be created")
}

func readWebhookSecret(t *testing.T, helper *common.GitTestHelper, repoName string) (string, error) {
	obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	repo, err := common.FromUnstructured[provisioning.Repository](obj)
	if err != nil {
		return "", err
	}
	secretName := repo.Secure.WebhookSecret.Name
	if secretName == "" {
		return "", fmt.Errorf("webhook secret is not stored")
	}
	decrypted, err := helper.GetEnv().DecryptService.Decrypt(t.Context(), provisioning.GROUP, repo.Namespace, secretName)
	if err != nil {
		return "", err
	}
	result, ok := decrypted[secretName]
	if !ok || result.Error() != nil || result.Value() == nil {
		return "", fmt.Errorf("webhook secret %s cannot be decrypted", secretName)
	}
	return result.Value().DangerouslyExposeAndConsumeValue(), nil
}

func requireProviderSecret(t *testing.T, helper *common.GitTestHelper, p Provider, repoName string) string {
	t.Helper()
	var secret string
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		var err error
		secret, err = readWebhookSecret(t, helper, repoName)
		require.NoError(collect, err)
		require.Equal(collect, secret, p.State(repoName).HookSecret, "the provider must have the repository secret")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "the provider must have the repository secret")
	return secret
}

func PostWebhook(t *testing.T, helper *common.GitTestHelper, p Provider, repoName string, header http.Header, body []byte) *unstructured.Unstructured {
	t.Helper()
	code, job := DeliverWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, http.StatusAccepted, code, "webhook should queue a job")
	return job
}

func DeliverWebhook(t *testing.T, helper *common.GitTestHelper, p Provider, repoName string, header http.Header, body []byte) (int, *unstructured.Unstructured) {
	t.Helper()
	code, job, err := TryDeliverWebhook(t, helper, p, repoName, header, body)
	require.NoError(t, err, "webhook should accept the event")
	return code, job
}

func TryDeliverWebhook(t *testing.T, helper *common.GitTestHelper, p Provider, repoName string, header http.Header, body []byte) (int, *unstructured.Unstructured, error) {
	t.Helper()
	secret, err := readWebhookSecret(t, helper, repoName)
	if err != nil {
		return 0, nil, err
	}
	p.Sign(header, secret, body)
	return TryDeliverSignedWebhook(t, helper, repoName, header, body)
}

func TryDeliverSignedWebhook(t *testing.T, helper *common.GitTestHelper, repoName string, header http.Header, body []byte) (int, *unstructured.Unstructured, error) {
	t.Helper()

	req := helper.AdminREST.Post().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repoName).
		SubResource("webhook").
		Body(body).
		SetHeader("Content-Type", "application/json")
	for key, values := range header {
		req = req.SetHeader(key, values...)
	}

	code := 0
	result := req.Do(t.Context()).StatusCode(&code)
	if err := result.Error(); err != nil {
		return code, nil, err
	}
	if code != http.StatusAccepted {
		return code, nil, nil
	}

	obj, err := result.Get()
	if err != nil {
		return code, nil, fmt.Errorf("webhook response should include the queued job: %w", err)
	}
	job, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return code, nil, fmt.Errorf("webhook response should be an unstructured job, got %T", obj)
	}
	return code, job, nil
}

func commentLink(t *testing.T, comment, marker string) *url.URL {
	t.Helper()
	start := strings.Index(comment, marker)
	require.NotEqualf(t, -1, start, "comment should contain %q:\n%s", marker, comment)
	rest := comment[start+len(marker):]
	end := strings.Index(rest, ")")
	require.NotEqualf(t, -1, end, "comment should close %q:\n%s", marker, comment)
	link, err := url.Parse(rest[:end])
	require.NoError(t, err, "comment should contain a valid URL after %q", marker)
	return link
}

func CommitDashboardOnBranch(t *testing.T, local *gittest.LocalRepo, branch, path string, dashboard []byte) string {
	t.Helper()
	_, err := local.Git("checkout", "-b", branch)
	require.NoError(t, err, "failed to create feature branch")
	require.NoError(t, local.UpdateFile(path, string(dashboard)))
	_, err = local.Git("commit", "-am", "Update dashboard")
	require.NoError(t, err, "failed to commit dashboard update")
	headSHA, err := local.Git("rev-parse", "HEAD")
	require.NoError(t, err, "failed to resolve feature branch SHA")
	return strings.TrimSpace(headSHA)
}

func RemoveCleanupFinalizer(t *testing.T, helper *common.GitTestHelper, repoName string) {
	t.Helper()
	patch := []byte(`{"metadata":{"finalizers":["remove-orphan-resources","remove-pending-jobs"]}}`)
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{})
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "remove cleanup finalizer")
}

func UpdateSpec(t *testing.T, helper *common.GitTestHelper, repoName string, mutate func(spec map[string]any)) {
	t.Helper()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		latest, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		updated := latest.DeepCopy()
		mutate(updated.Object["spec"].(map[string]any))
		_, err = helper.Repositories.Resource.Update(t.Context(), updated, metav1.UpdateOptions{})
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "spec update should succeed")
}

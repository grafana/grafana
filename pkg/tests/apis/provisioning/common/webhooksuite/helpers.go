package webhooksuite

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

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

type RepoOptions struct {
	WebhookDisabled bool
	SyncEnabled     bool
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
	helper.WaitForHealthyRepository(t, repoName)
}

func ExpectedWebhookURL(namespace, repoName string) string {
	gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
	return fmt.Sprintf("%s/apis/%s/%s/namespaces/%s/%s/%s/webhook",
		strings.TrimRight(WebhookBaseURL, "/"), gvr.Group, gvr.Version, namespace, gvr.Resource, repoName)
}

func getRepository(t *testing.T, helper *common.GitTestHelper, repoName string) *provisioning.Repository {
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
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		require.NotNil(collect, repo.Status.Webhook, "webhook should be set")
		require.NotEmpty(collect, repo.Secure.WebhookSecret.Name, "webhook secret should be created")
		require.Equal(collect, expected, repository.GetID(repo.Status.Webhook))
		require.Equal(collect, ExpectedWebhookURL(helper.Namespace, repoName), repo.Status.Webhook.URL)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be created")
}

func webhookSecret(t *testing.T, helper *common.GitTestHelper, repoName string) string {
	t.Helper()
	repo := getRepository(t, helper, repoName)
	secretName := repo.Secure.WebhookSecret.Name
	require.NotEmpty(t, secretName, "webhook secret should be stored")

	decrypted, err := helper.GetEnv().DecryptService.Decrypt(t.Context(), provisioning.GROUP, repo.Namespace, secretName)
	require.NoError(t, err, "failed to decrypt webhook secret")
	result, ok := decrypted[secretName]
	require.True(t, ok, "decrypted webhook secret should be returned")
	require.NoError(t, result.Error(), "webhook secret decrypt result should not contain an error")
	require.NotNil(t, result.Value(), "webhook secret value should be present")
	return result.Value().DangerouslyExposeAndConsumeValue()
}

func PostWebhook(t *testing.T, helper *common.GitTestHelper, p Provider, repoName string, header http.Header, body []byte) *unstructured.Unstructured {
	t.Helper()
	code, job := DeliverWebhook(t, helper, p, repoName, header, body)
	require.Equal(t, http.StatusAccepted, code, "webhook should queue a job")
	return job
}

func DeliverWebhook(t *testing.T, helper *common.GitTestHelper, p Provider, repoName string, header http.Header, body []byte) (int, *unstructured.Unstructured) {
	t.Helper()
	p.Sign(header, webhookSecret(t, helper, repoName), body)

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
	require.NoError(t, result.Error(), "webhook should accept the event")
	if code != http.StatusAccepted {
		return code, nil
	}

	obj, err := result.Get()
	require.NoError(t, err, "webhook response should include the queued job")
	job, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "webhook response should be an unstructured job, got %T", obj)
	return code, job
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func MustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

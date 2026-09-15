// SPDX-License-Identifier: AGPL-3.0-only

package fileprovisioning

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fake "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
)

func TestProvision(t *testing.T) {
	t.Setenv("GIT_PAT", "secret-token")
	t.Setenv("GITHUB_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\nline-one\nline-two\n-----END PRIVATE KEY-----")

	dir := t.TempDir()
	contents := `apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: dashboards
spec:
  title: Dashboards
  type: git
  git:
    url: https://example.com/dashboards.git
    branch: main
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
secure:
  token:
    create: ${GIT_PAT}
---
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: github-app
spec:
  title: GitHub App
  type: github
  url: https://github.com
  github:
    appID: 123
    installationID: 456
secure:
  privateKey:
    create: ${GITHUB_PRIVATE_KEY}
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "git-sync.yaml"), []byte(contents), 0o600))

	client := fake.NewSimpleClientset().ProvisioningV0alpha1()
	require.NoError(t, Provision(context.Background(), dir, client))

	repo, err := client.Repositories(DefaultNamespace).Get(context.Background(), "dashboards", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "Dashboards", repo.Spec.Title)
	require.Equal(t, "secret-token", string(repo.Secure.Token.Create))

	conn, err := client.Connections(DefaultNamespace).Get(context.Background(), "github-app", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "GitHub App", conn.Spec.Title)
	require.Equal(t, "123", conn.Spec.GitHub.AppID)
	require.Equal(t, "456", conn.Spec.GitHub.InstallationID)
	require.Equal(t, "-----BEGIN PRIVATE KEY-----\nline-one\nline-two\n-----END PRIVATE KEY-----", string(conn.Secure.PrivateKey.Create))
}

func TestProvisionUpdatesExistingResource(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "repository.yaml")
	write := func(title string) {
		require.NoError(t, os.WriteFile(path, []byte(`apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: dashboards
spec:
  title: `+title+`
  type: local
  local:
    path: /var/lib/grafana/dashboards
  sync:
    enabled: true
    target: folder
`), 0o600))
	}

	write("First")
	client := fake.NewSimpleClientset().ProvisioningV0alpha1()
	require.NoError(t, Provision(context.Background(), dir, client))

	first, err := client.Repositories(DefaultNamespace).Get(context.Background(), "dashboards", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "First", first.Spec.Title)

	write("Second")
	require.NoError(t, Provision(context.Background(), dir, client))

	second, err := client.Repositories(DefaultNamespace).Get(context.Background(), "dashboards", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "Second", second.Spec.Title)
	require.Equal(t, first.UID, second.UID)
}

func TestProvisionPreservesExistingMetadata(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "repository.yaml")
	require.NoError(t, os.WriteFile(path, []byte(`apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: dashboards
spec:
  title: Updated
  type: local
  local:
    path: /var/lib/grafana/dashboards
  sync:
    enabled: true
    target: folder
`), 0o600))

	existing := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "dashboards",
			Namespace:   DefaultNamespace,
			Labels:      map[string]string{"managed-by": "controller"},
			Annotations: map[string]string{"example.com/annotation": "keep-me"},
			Finalizers:  []string{"example.com/finalizer"},
		},
	}
	client := fake.NewSimpleClientset(existing).ProvisioningV0alpha1()

	require.NoError(t, Provision(context.Background(), dir, client))

	updated, err := client.Repositories(DefaultNamespace).Get(context.Background(), "dashboards", metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "Updated", updated.Spec.Title)
	require.Equal(t, existing.Labels, updated.Labels)
	require.Equal(t, existing.Annotations, updated.Annotations)
	require.Equal(t, existing.Finalizers, updated.Finalizers)
}

package bootstrap

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fakeclientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDeclaredNamespaces(t *testing.T) {
	root := t.TempDir()
	write := func(path, content string) {
		t.Helper()
		full := filepath.Join(root, path)
		require.NoError(t, os.MkdirAll(filepath.Dir(full), 0o750))
		require.NoError(t, os.WriteFile(full, []byte(content), 0o600))
	}

	write("repo.yaml", "apiVersion: provisioning.grafana.app/v0alpha1\nkind: Repository\nmetadata:\n  name: a\n  namespace: org-2\n")
	write("nested/dashboard.json", `{"apiVersion":"dashboard.grafana.app/v1beta1","kind":"Dashboard","metadata":{"name":"b","namespace":"org-3"},"spec":{}}`)
	write("default.yaml", "apiVersion: provisioning.grafana.app/v0alpha1\nkind: Repository\nmetadata:\n  name: c\n")
	write("classic.json", `{"title":"classic","schemaVersion":41,"panels":[]}`)
	write("README.md", "# not a resource")
	write("notes.txt", "metadata:\n  namespace: org-9\n")
	write(".hidden/secret.yaml", "metadata:\n  namespace: org-8\n")
	write("broken.yaml", "apiVersion: [")

	got, err := DeclaredNamespaces(context.Background(), root)
	require.NoError(t, err)
	assert.Equal(t, []string{"org-2", "org-3"}, sorted(got),
		"only decodable resource files that name a namespace declare one")
}

func TestDeclaredNamespacesMissingDirectory(t *testing.T) {
	_, err := DeclaredNamespaces(context.Background(), filepath.Join(t.TempDir(), "absent"))
	assert.Error(t, err)
}

func TestRegistrarRegistersEveryDeclaredNamespace(t *testing.T) {
	root := t.TempDir()
	writeManifest(t, root, "repo.yaml", "org-2")
	client := newClientset()

	require.NoError(t, registrar(root, "org-2", "org-3").Reconcile(context.Background(), clientRepos(client)))

	assert.Equal(t, config.Path, pathIn(t, client, "default"),
		"the default org owns the manifests that name no namespace")
	assert.Equal(t, config.Path, pathIn(t, client, "org-2"))
	assertAbsent(t, client, "org-3")
}

func TestRegistrarRemovesARepositoryNoManifestNames(t *testing.T) {
	root := t.TempDir()
	client := newClientset(ownedRepository(t, "org-2"))

	require.NoError(t, registrar(root, "org-2").Reconcile(context.Background(), clientRepos(client)))

	assertAbsent(t, client, "org-2")
	assert.Equal(t, config.Path, pathIn(t, client, "default"))
}

func TestRegistrarRemovesEveryRepositoryWhenThePathIsCleared(t *testing.T) {
	client := newClientset(ownedRepository(t, "default"), ownedRepository(t, "org-2"))
	reg := registrar("", "org-2")
	reg.Path = ""

	require.NoError(t, reg.Reconcile(context.Background(), clientRepos(client)))

	assertAbsent(t, client, "default")
	assertAbsent(t, client, "org-2")
}

func TestRegistrarReportsAnUnknownNamespace(t *testing.T) {
	root := t.TempDir()
	writeManifest(t, root, "repo.yaml", "org-7")
	client := newClientset()

	// The manifest names an org this instance does not have, so nothing provisions it. The
	// error is logged; the orgs that do exist are still reconciled.
	require.NoError(t, registrar(root, "org-2").Reconcile(context.Background(), clientRepos(client)))

	assertAbsent(t, client, "org-7")
	assert.Equal(t, config.Path, pathIn(t, client, "default"))
}

func TestRegistrarKeepsReconcilingAfterOneNamespaceFails(t *testing.T) {
	root := t.TempDir()
	writeManifest(t, root, "repo.yaml", "org-2")
	client := newClientset()

	repos := func(namespace string) Repositories {
		if namespace == "default" {
			return failingRepositories{}
		}
		return client.ProvisioningV0alpha1().Repositories(namespace)
	}
	err := registrar(root, "org-2").Reconcile(context.Background(), repos)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "namespace default")
	assert.Equal(t, config.Path, pathIn(t, client, "org-2"))
}

func TestRegistrarFailsWhenTheOrgsCannotBeListed(t *testing.T) {
	reg := registrar(t.TempDir())
	reg.Orgs = func(context.Context) ([]string, error) { return nil, errors.New("boom") }

	err := reg.Reconcile(context.Background(), clientRepos(newClientset()))
	assert.Error(t, err)
}

func TestOrgNamespaceListerDeduplicates(t *testing.T) {
	orgSvc := orgtest.NewOrgServiceFake()
	orgSvc.ExpectedOrgs = []*org.OrgDTO{{ID: 1}, {ID: 2}, {ID: 3}}

	// The cloud mapper maps every org onto the stack's single namespace, which holds one
	// bootstrap repository however many orgs point at it.
	lister := OrgNamespaceLister(request.GetNamespaceMapper(&setting.Cfg{StackID: "7"}), orgSvc)
	got, err := lister(context.Background())
	require.NoError(t, err)
	assert.Len(t, got, 1)

	lister = OrgNamespaceLister(request.GetNamespaceMapper(&setting.Cfg{}), orgSvc)
	got, err = lister(context.Background())
	require.NoError(t, err)
	assert.Equal(t, []string{"default", "org-2", "org-3"}, got)
}

func registrar(root string, orgNamespaces ...string) Registrar {
	return Registrar{
		Path:             config.Path,
		Root:             root,
		DefaultNamespace: "default",
		Orgs: func(context.Context) ([]string, error) {
			return append([]string{"default"}, orgNamespaces...), nil
		},
	}
}

func clientRepos(client *fakeclientset.Clientset) func(string) Repositories {
	return func(namespace string) Repositories {
		return client.ProvisioningV0alpha1().Repositories(namespace)
	}
}

func writeManifest(t *testing.T, root, path, namespace string) {
	t.Helper()
	content := "apiVersion: provisioning.grafana.app/v0alpha1\nkind: Repository\nmetadata:\n  name: declared\n  namespace: " + namespace + "\n"
	require.NoError(t, os.WriteFile(filepath.Join(root, path), []byte(content), 0o600))
}

func ownedRepository(t *testing.T, namespace string) *provisioning.Repository {
	t.Helper()
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: namespace},
	}
	Config{Path: config.Path, Namespace: namespace}.apply(repo)
	return repo
}

func pathIn(t *testing.T, client *fakeclientset.Clientset, namespace string) string {
	t.Helper()
	repo, err := client.ProvisioningV0alpha1().Repositories(namespace).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	require.NotNil(t, repo.Spec.Local)
	return repo.Spec.Local.Path
}

func assertAbsent(t *testing.T, client *fakeclientset.Clientset, namespace string) {
	t.Helper()
	_, err := client.ProvisioningV0alpha1().Repositories(namespace).Get(context.Background(), Name, metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "expected no bootstrap repository in %s, got %v", namespace, err)
}

func sorted(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for ns := range set {
		out = append(out, ns)
	}
	sort.Strings(out)
	return out
}

type failingRepositories struct{}

func (failingRepositories) Get(context.Context, string, metav1.GetOptions) (*provisioning.Repository, error) {
	return nil, errors.New("boom")
}

func (failingRepositories) Create(context.Context, *provisioning.Repository, metav1.CreateOptions) (*provisioning.Repository, error) {
	return nil, errors.New("boom")
}

func (failingRepositories) Update(context.Context, *provisioning.Repository, metav1.UpdateOptions) (*provisioning.Repository, error) {
	return nil, errors.New("boom")
}

func (failingRepositories) Delete(context.Context, string, metav1.DeleteOptions) error {
	return errors.New("boom")
}

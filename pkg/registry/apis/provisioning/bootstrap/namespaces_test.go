package bootstrap

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fakeclientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRegistrarRegistersEveryOrg(t *testing.T) {
	client := newClientset()

	require.NoError(t, registrar("org-2", "org-3").Reconcile(context.Background(), clientRepos(client)))

	for _, ns := range []string{"default", "org-2", "org-3"} {
		assert.Equal(t, config.Path, pathIn(t, client, ns))
	}
}

func TestRegistrarRegistersTheDefaultOrgWithoutARecord(t *testing.T) {
	client := newClientset()
	reg := registrar()
	reg.Orgs = func(context.Context) ([]string, error) { return nil, nil }

	// auto_assign_org_id can name an org with no record, and bootstrap_path provisions it.
	require.NoError(t, reg.Reconcile(context.Background(), clientRepos(client)))

	assert.Equal(t, config.Path, pathIn(t, client, "default"))
}

func TestRegistrarRemovesEveryRepositoryWhenThePathIsCleared(t *testing.T) {
	client := newClientset(ownedRepository(t, "default"), ownedRepository(t, "org-2"))
	reg := registrar("org-2")
	reg.Path = ""

	require.NoError(t, reg.Reconcile(context.Background(), clientRepos(client)))

	assertAbsent(t, client, "default")
	assertAbsent(t, client, "org-2")
}

func TestRegistrarKeepsReconcilingAfterOneOrgFails(t *testing.T) {
	client := newClientset()
	repos := func(namespace string) Repositories {
		if namespace == "default" {
			return failingRepositories{}
		}
		return client.ProvisioningV0alpha1().Repositories(namespace)
	}

	err := registrar("org-2").Reconcile(context.Background(), repos)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "namespace default")
	assert.Equal(t, config.Path, pathIn(t, client, "org-2"))
}

func TestRegistrarFailsWhenTheOrgsCannotBeListed(t *testing.T) {
	reg := registrar()
	reg.Orgs = func(context.Context) ([]string, error) { return nil, errors.New("boom") }

	assert.Error(t, reg.Reconcile(context.Background(), clientRepos(newClientset())))
}

func TestRegistrarRunRegistersAnOrgCreatedAfterStartup(t *testing.T) {
	client := newClientset()
	var mu sync.Mutex
	namespaces := make([]string, 0, 2)
	namespaces = append(namespaces, "default")
	reg := registrar()
	reg.Orgs = func(context.Context) ([]string, error) {
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), namespaces...), nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go reg.Run(ctx, clientRepos(client), time.Millisecond)

	mu.Lock()
	namespaces = append(namespaces, "org-4")
	mu.Unlock()

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		_, err := client.ProvisioningV0alpha1().Repositories("org-4").Get(ctx, Name, metav1.GetOptions{})
		assert.NoError(c, err)
	}, 5*time.Second, time.Millisecond)
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

	// On-prem the first org is the default namespace.
	lister = OrgNamespaceLister(request.GetNamespaceMapper(&setting.Cfg{}), orgSvc)
	got, err = lister(context.Background())
	require.NoError(t, err)
	assert.Equal(t, []string{"default", "org-2", "org-3"}, got)
}

func registrar(orgNamespaces ...string) Registrar {
	return Registrar{
		Path:             config.Path,
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

// Deleting an org leaves its repository behind -- org deletion does not cover provisioning
// resources -- and the org never appears in the org list again, so nothing else retires it.
func TestRegistrarRetiresARepositoryWhoseOrgIsGone(t *testing.T) {
	client := newClientset(ownedRepository(t, "default"), ownedRepository(t, "org-9"))
	reg := registrar()
	reg.Existing = func(context.Context) ([]provisioning.Repository, error) {
		return listRepositories(t, client, "default", "org-9"), nil
	}

	require.NoError(t, reg.Reconcile(context.Background(), clientRepos(client)))

	assertAbsent(t, client, "org-9")
	assert.Equal(t, config.Path, pathIn(t, client, "default"), "the live org keeps its own")
}

func TestRegistrarLeavesARepositoryItDoesNotOwn(t *testing.T) {
	foreign := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: "org-9"},
	}
	client := newClientset(foreign)
	reg := registrar()
	reg.Existing = func(context.Context) ([]provisioning.Repository, error) {
		return []provisioning.Repository{*foreign}, nil
	}

	require.NoError(t, reg.Reconcile(context.Background(), clientRepos(client)))

	_, err := client.ProvisioningV0alpha1().Repositories("org-9").Get(context.Background(), Name, metav1.GetOptions{})
	assert.NoError(t, err, "a repository with no file-provisioning manager is not ours to delete")
}

// Only one repository may claim the manifests that name no namespace, or an unnamespaced
// dashboard is provisioned into every org at once.
func TestRegistrarMarksOnlyTheDefaultOrg(t *testing.T) {
	client := newClientset()

	require.NoError(t, registrar("org-2").Reconcile(context.Background(), clientRepos(client)))

	assert.Equal(t, "true", annotationIn(t, client, "default"))
	assert.Empty(t, annotationIn(t, client, "org-2"))
}

// With no path there is nothing to keep registered, so the loop must not search the orgs
// forever once the leftovers are gone.
func TestRegistrarRunStopsOnceTheDisabledCleanupSucceeds(t *testing.T) {
	var passes atomic.Int64
	reg := registrar()
	reg.Path = ""
	reg.Orgs = func(context.Context) ([]string, error) {
		passes.Add(1)
		return []string{"default"}, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() {
		reg.Run(ctx, clientRepos(newClientset()), time.Millisecond)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop after a clean pass")
	}
	assert.Equal(t, int64(1), passes.Load())
}

func TestRegistrarRunKeepsRetryingAFailedCleanup(t *testing.T) {
	var passes atomic.Int64
	reg := registrar()
	reg.Path = ""
	reg.Orgs = func(context.Context) ([]string, error) {
		if passes.Add(1) < 3 {
			return nil, errors.New("boom")
		}
		return []string{"default"}, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() {
		reg.Run(ctx, clientRepos(newClientset()), time.Millisecond)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop once the cleanup succeeded")
	}
	assert.Equal(t, int64(3), passes.Load())
}

func annotationIn(t *testing.T, client *fakeclientset.Clientset, namespace string) string {
	t.Helper()
	repo, err := client.ProvisioningV0alpha1().Repositories(namespace).Get(context.Background(), Name, metav1.GetOptions{})
	require.NoError(t, err)
	return repo.Annotations[resources.AnnoKeyBootstrapDefaultOrg]
}

func listRepositories(t *testing.T, client *fakeclientset.Clientset, namespaces ...string) []provisioning.Repository {
	t.Helper()
	var out []provisioning.Repository
	for _, ns := range namespaces {
		repo, err := client.ProvisioningV0alpha1().Repositories(ns).Get(context.Background(), Name, metav1.GetOptions{})
		if err != nil {
			continue
		}
		out = append(out, *repo)
	}
	return out
}

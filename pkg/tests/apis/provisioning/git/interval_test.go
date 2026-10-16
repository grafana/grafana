package git

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/nanogit/gittest"
	"github.com/grafana/nanogit/options"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	gitrepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	syncjob "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_GitSyncIntervalNoop(t *testing.T) {
	helper, _ := newIntervalRepository(t, "git-interval-noop", "interval-noop")
	runIO := newIntervalIO(t)

	synctest.Test(t, func(t *testing.T) {
		pipeline := newIntervalPipeline(t, helper, runIO, "git-interval-noop")
		pipeline.reconcile(t)
		pipeline.sync(t)
		original := pipeline.repository(t).Status.Sync
		require.NotZero(t, original.Finished)
		require.NotZero(t, original.LastChecked)
		require.NotEmpty(t, original.LastRef)
		require.NotEmpty(t, original.JobID)
		initialJobs := pipeline.history(t)
		require.Len(t, initialJobs, 1)

		// Advance past the completed sync's interval so the unchanged Git ref is checked again.
		synctest.Sleep(time.Minute)
		pipeline.reconcile(t)
		expected := original
		expected.LastChecked = time.Now().UnixMilli()
		require.Equal(t, expected, pipeline.repository(t).Status.Sync)
		pipeline.requireNoJobs(t)

		// Stop before the interval's one-second tolerance to prove lastChecked postpones another check.
		synctest.Sleep(time.Minute - 2*time.Second)
		pipeline.reconcile(t)
		require.Equal(t, expected, pipeline.repository(t).Status.Sync)
		pipeline.requireNoJobs(t)

		// Reach the next interval to prove an unchanged ref keeps resetting polling without creating jobs.
		synctest.Sleep(2 * time.Second)
		pipeline.reconcile(t)
		expected.LastChecked = time.Now().UnixMilli()
		require.Equal(t, expected, pipeline.repository(t).Status.Sync)
		pipeline.requireNoJobs(t)
		require.Equal(t, initialJobs, pipeline.history(t))
	})
}

func TestIntegrationProvisioning_GitSyncIntervalChangedRef(t *testing.T) {
	helper, local := newIntervalRepository(t, "git-interval-changed", "interval-changed-1")
	runIO := newIntervalIO(t)

	synctest.Test(t, func(t *testing.T) {
		pipeline := newIntervalPipeline(t, helper, runIO, "git-interval-changed")
		pipeline.reconcile(t)
		pipeline.sync(t)
		original := pipeline.repository(t).Status.Sync

		require.NoError(t, local.CreateFile("dashboard2.json", string(common.DashboardJSON("interval-changed-2", "Second Dashboard", 1))))
		gitCommitPush(t, local, "add second dashboard")
		ref, err := local.Git("rev-parse", "HEAD")
		require.NoError(t, err)
		latestRef := strings.TrimSpace(ref)
		require.NotEqual(t, original.LastRef, latestRef)

		// A new Git commit must not schedule a sync before the configured interval is due.
		synctest.Sleep(time.Minute - 2*time.Second)
		pipeline.reconcile(t)
		require.Equal(t, original, pipeline.repository(t).Status.Sync)
		pipeline.requireNoJobs(t)

		// Make the interval due, allowing reconciliation to discover the new Git commit.
		synctest.Sleep(2 * time.Second)
		pipeline.reconcile(t)
		checked := time.Now().UnixMilli()
		pending := pipeline.repository(t).Status.Sync
		require.Equal(t, provisioning.JobStatePending, pending.State)
		require.Equal(t, checked, pending.LastChecked)
		require.Equal(t, original.LastRef, pending.LastRef)

		// Delay job pickup to distinguish the controller's check timestamp from the worker's completion time.
		synctest.Sleep(time.Second)
		pipeline.sync(t)
		synced := pipeline.repository(t).Status.Sync
		require.Equal(t, provisioning.JobStateSuccess, synced.State)
		require.Equal(t, latestRef, synced.LastRef)
		require.Equal(t, checked, synced.LastChecked)
		require.Greater(t, synced.Finished, checked)
		history := pipeline.history(t)
		require.Len(t, history, 2)
		for _, job := range history {
			require.Equal(t, provisioning.JobStateSuccess, job.Status.State)
		}

		for _, uid := range []string{"interval-changed-1", "interval-changed-2"} {
			dashboard, err := pipeline.dynamic.Resource(resources.DashboardResource).Namespace(pipeline.namespace).Get(pipeline.ctx, uid, metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, pipeline.name, dashboard.GetAnnotations()["grafana.app/managerId"])
		}
	})
}

// Keep the API and Git servers outside the bubble: only reconciliation and job execution use virtual time.
func newIntervalRepository(t *testing.T, name, dashboardUID string) (*common.GitTestHelper, *gittest.LocalRepo) {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	helper := common.RunGrafanaWithGitServer(t, common.WithoutProvisioningFolderMetadata, func(opts *testinfra.GrafanaOpts) {
		opts.DisableControllers = true
	})
	user, err := helper.GitServer().CreateUser(t.Context())
	require.NoError(t, err)
	remote, local := helper.CreateRemoteGitRepo(t, name, user, map[string][]byte{
		"dashboard1.json": common.DashboardJSON(dashboardUID, "First Dashboard", 1),
	})
	obj := helper.RenderObject(t, common.TestdataPath("git.json.tmpl"), map[string]any{
		"Name": name, "URL": remote.URL, "Branch": "main", "TokenUser": user.Username,
		"Token": user.Password, "SyncTarget": "instance", "SyncEnabled": true,
		"SyncIntervalSeconds": 60, "WorkflowsJSON": `["write"]`,
	})
	_, err = helper.Repositories.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return helper, local
}

type intervalPipeline struct {
	ctx        context.Context
	client     client.ProvisioningV0alpha1Interface
	dynamic    dynamic.Interface
	controller *controller.RepositoryController
	driver     *jobs.ConcurrentJobDriver
	namespace  string
	name       string
}

func newIntervalPipeline(t *testing.T, helper *common.GitTestHelper, runIO func(func()), name string) *intervalPipeline {
	t.Helper()
	// Idle network reads cannot durably block in synctest. Each real HTTP request must release its connection.
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DisableKeepAlives = true
	t.Cleanup(transport.CloseIdleConnections)
	config, err := helper.GetEnv().GetRestConfig(t.Context())
	require.NoError(t, err)
	config = rest.CopyConfig(config)
	config.Transport = &intervalTransport{RoundTripper: config.Transport, run: runIO}
	configProvider := apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) { return config, nil })
	c, err := client.NewForConfig(config)
	require.NoError(t, err)
	dynamicClient, err := dynamic.NewForConfig(config)
	require.NoError(t, err)
	registry := prometheus.NewPedanticRegistry()
	tracer := tracing.NewNoopTracerService()
	factory, err := repository.ProvideFactory(map[provisioning.RepositoryType]struct{}{provisioning.GitRepositoryType: {}}, []repository.Extra{
		gitrepo.Extra(repository.ProvideDecrypter(helper.GetEnv().DecryptService, nil), true, nil, nil,
			options.WithHTTPClient(&http.Client{Transport: transport})),
	}, tracer)
	require.NoError(t, err)
	clients := resources.NewClientFactory(configProvider)
	lister := &intervalResourceLister{lister: resources.NewResourceLister(helper.GetEnv().ResourceClient), run: runIO}
	repositoryResources := resources.NewRepositoryResourcesFactory(resources.NewParserFactory(clients, false), clients, lister, false)
	store, err := jobs.NewJobStore(c, time.Minute, registry)
	require.NoError(t, err)
	patcher := appcontroller.NewRepositoryStatusPatcher(c)
	getter := informer.NewClientRepositoryGetter(c, informer.NewRepositorySnapshot(usinformer.NewStore()))
	health := controller.NewRepositoryHealthChecker(patcher, repository.NewTester(repository.NewValidator(false, factory)), controller.NewHealthMetricsRecorder(registry))
	rc := controller.NewRepositoryController(c, getter, factory, nil, lister, clients, store, health, patcher,
		registry, tracer, 10, time.Minute, helper.GetEnv().Cfg.ProvisioningMinSyncInterval, time.Second, helper.GetEnv().QuotaGetter,
		controller.NewRepositoryQuotaChecker(getter), repository.NewIncrementalSyncPolicy(false, 0), 30*24*time.Hour, false)
	metrics := jobs.RegisterJobMetrics(registry)
	syncer := syncjob.NewSyncer(syncjob.Compare, syncjob.FullSync, syncjob.IncrementalSync, tracer, 10, metrics, false, 0) //nolint:staticcheck
	worker := syncjob.NewSyncWorker(clients, repositoryResources, patcher.Patch, syncer, metrics, tracer, 10, 0)
	driver, err := jobs.NewConcurrentJobDriver(1, time.Minute, time.Minute, 0, store, resources.NewRepositoryGetter(factory, c), jobs.NewAPIClientHistoryWriter(c), registry, &metrics, false, worker)
	require.NoError(t, err)
	ctx, _, err := identity.WithProvisioningIdentity(t.Context(), helper.Namespace)
	require.NoError(t, err)
	runCtx, cancel := context.WithCancel(ctx)
	driverDone := make(chan error, 1)
	t.Cleanup(func() {
		cancel()
		require.NoError(t, <-driverDone)
	})
	go rc.Run(runCtx, 1, func() {}, func() {})
	go func() { driverDone <- driver.Run(runCtx) }()
	return &intervalPipeline{
		ctx: ctx, client: c, dynamic: dynamicClient, controller: rc, driver: driver,
		namespace: helper.Namespace, name: name,
	}
}

// The in-process API and index use process-wide workers that cannot share bubble-owned channels.
// Join each operation outside the bubble so virtual time cannot advance during storage I/O.
func newIntervalIO(t *testing.T) func(func()) {
	t.Helper()
	operations := make(chan func())
	completed := make(chan struct{})
	done := make(chan struct{})
	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(func() {
		cancel()
		<-done
	})
	go func() {
		defer close(done)
		for {
			select {
			case operation := <-operations:
				operation()
				completed <- struct{}{}
			case <-ctx.Done():
				return
			}
		}
	}()
	var mu sync.Mutex
	return func(operation func()) {
		mu.Lock()
		defer mu.Unlock()
		operations <- operation
		<-completed
	}
}

type intervalTransport struct {
	http.RoundTripper
	run func(func())
}

func (t *intervalTransport) RoundTrip(req *http.Request) (response *http.Response, err error) {
	// Preserve the requester while keeping bubble-owned cancellation channels away from global workers.
	t.run(func() {
		response, err = t.RoundTripper.RoundTrip(req.WithContext(context.WithoutCancel(req.Context())))
	})
	return response, err
}

type intervalResourceLister struct {
	lister resources.ResourceLister
	run    func(func())
}

func (l *intervalResourceLister) List(ctx context.Context, namespace, name string) (list *provisioning.ResourceList, err error) {
	l.run(func() { list, err = l.lister.List(context.WithoutCancel(ctx), namespace, name) })
	return list, err
}

func (l *intervalResourceLister) Stats(ctx context.Context, namespace, name string) (stats *provisioning.ResourceStats, err error) {
	l.run(func() { stats, err = l.lister.Stats(context.WithoutCancel(ctx), namespace, name) })
	return stats, err
}

func (p *intervalPipeline) repository(t *testing.T) *provisioning.Repository {
	t.Helper()
	repo, err := p.client.Repositories(p.namespace).Get(p.ctx, p.name, metav1.GetOptions{})
	require.NoError(t, err)
	return repo
}

func (p *intervalPipeline) reconcile(t *testing.T) {
	t.Helper()
	p.controller.EventHandler().AddFunc(p.repository(t), false)
	// Finish this queued reconciliation, including its status patch and job insertion, before inspecting results.
	synctest.Wait()
}

func (p *intervalPipeline) sync(t *testing.T) {
	t.Helper()
	queued, err := p.client.Jobs(p.namespace).List(p.ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, queued.Items, 1)
	p.driver.EventHandler().AddFunc(&queued.Items[0], false)
	// Finish the real sync worker, job completion, and history write before reading repository state.
	synctest.Wait()
	status := p.repository(t).Status.Sync
	require.Equal(t, provisioning.JobStateSuccess, status.State, "%v", status.Message)
	p.requireNoJobs(t)
}

func (p *intervalPipeline) requireNoJobs(t *testing.T) {
	t.Helper()
	queued, err := p.client.Jobs(p.namespace).List(p.ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, queued.Items)
}

func (p *intervalPipeline) history(t *testing.T) []provisioning.HistoricJob {
	t.Helper()
	history, err := p.client.HistoricJobs(p.namespace).List(p.ctx, metav1.ListOptions{})
	require.NoError(t, err)
	return history.Items
}

package informer

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
	usinformer "github.com/grafana/grafana/pkg/storage/unified/informer"
)

// benchRepo is a realistic repository: a GitHub-backed one that has synced, with
// the status, stats and conditions the controller writes. Payload size is what
// decides whether reading objects back beats listing them, so a stub object
// would make the keys projection look better than it is.
func benchRepo(i int) *provisioningapis.Repository {
	now := metav1.Now()
	return &provisioningapis.Repository{
		TypeMeta: metav1.TypeMeta{APIVersion: provisioningapis.APIVERSION, Kind: "Repository"},
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "stacks-1234567", Name: fmt.Sprintf("github-repo-%06d", i),
			ResourceVersion: strconv.Itoa(1812345678901234567 + i),
			Generation:      7, CreationTimestamp: now,
			UID:         "0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9",
			Finalizers:  []string{"provisioning.grafana.app/remove-orphan-resources", "provisioning.grafana.app/clean-finalizer"},
			Labels:      map[string]string{"grafana.app/managedBy": "provisioning"},
			Annotations: map[string]string{"grafana.app/updatedBy": "user:1", "grafana.app/updatedTimestamp": now.Format(time.RFC3339)},
		},
		Spec: provisioningapis.RepositorySpec{
			Title: "Production dashboards", Description: "Everything under observability/prod",
			Type: provisioningapis.GitHubRepositoryType, Workflows: []provisioningapis.Workflow{"branch", "write"},
			Sync: provisioningapis.SyncOptions{Enabled: true, Target: "folder", IntervalSeconds: 60},
			GitHub: &provisioningapis.GitHubRepositoryConfig{
				URL: "https://github.com/grafana/observability-dashboards", Branch: "main",
				Path: "dashboards/production", GenerateDashboardPreviews: true,
			},
		},
		Status: provisioningapis.RepositoryStatus{
			ObservedGeneration: 7,
			Health:             provisioningapis.HealthStatus{Healthy: true, Checked: now.UnixMilli()},
			Sync: provisioningapis.SyncStatus{
				State: provisioningapis.JobStateSuccess, JobID: "j-0a1b2c3d4e5f",
				Started: now.UnixMilli(), Finished: now.UnixMilli(), Scheduled: now.UnixMilli(),
				Incremental: true, LastRef: "a1b2c3d4e5f60718293a",
				Message: []string{"synced 142 dashboards, 17 folders"},
			},
			Stats: []provisioningapis.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 142},
				{Group: "folder.grafana.app", Resource: "folders", Count: 17},
			},
			Conditions: []metav1.Condition{
				{Type: "Ready", Status: metav1.ConditionTrue, Reason: "HealthCheckPassed", Message: "repository is healthy", LastTransitionTime: now, ObservedGeneration: 7},
				{Type: "NamespaceQuota", Status: metav1.ConditionTrue, Reason: "WithinQuota", Message: "within quota: 3/10 repositories", LastTransitionTime: now, ObservedGeneration: 7},
			},
		},
	}
}

// benchServer serves the three endpoints a re-list uses, counting requests and
// bytes so the benchmark reports wire cost alongside time. rtt is added to every
// response: on loopback a round trip is nearly free, which flatters per-key
// reads, so the in-cluster case has to be modelled explicitly.
type benchServer struct {
	srv      *httptest.Server
	requests atomic.Int64
	bytes    atomic.Int64
}

func newBenchServer(t testing.TB, repos []*provisioningapis.Repository, rtt time.Duration) *benchServer {
	t.Helper()
	b := &benchServer{}
	byName := make(map[string]*provisioningapis.Repository, len(repos))
	for _, r := range repos {
		byName[r.Name] = r
	}

	write := func(w http.ResponseWriter, body any) {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		if rtt > 0 {
			time.Sleep(rtt)
		}
		b.requests.Add(1)
		b.bytes.Add(int64(len(raw)))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}

	mux := http.NewServeMux()
	// Keys projection.
	mux.HandleFunc("POST /apis/provisioning.grafana.app/v0alpha1/repositories/list-keys", func(w http.ResponseWriter, r *http.Request) {
		var opts metav1.ListOptions
		_ = json.NewDecoder(r.Body).Decode(&opts)
		items := make([]metav1.PartialObjectMetadata, 0, len(repos))
		for _, repo := range repos {
			items = append(items, metav1.PartialObjectMetadata{
				TypeMeta:   metav1.TypeMeta{APIVersion: "meta.k8s.io/v1", Kind: "PartialObjectMetadata"},
				ObjectMeta: metav1.ObjectMeta{Namespace: repo.Namespace, Name: repo.Name, ResourceVersion: repo.ResourceVersion},
			})
		}
		write(w, metav1.PartialObjectMetadataList{
			TypeMeta: metav1.TypeMeta{APIVersion: "meta.k8s.io/v1", Kind: "PartialObjectMetadataList"},
			ListMeta: metav1.ListMeta{ResourceVersion: "1900000000000000000"},
			Items:    items,
		})
	})
	// One object, the read-back.
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/namespaces/{ns}/repositories/{name}", func(w http.ResponseWriter, r *http.Request) {
		repo, ok := byName[r.PathValue("name")]
		if !ok {
			http.NotFound(w, r)
			return
		}
		write(w, repo)
	})
	// Full list, paged the way unified storage pages it.
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/repositories", func(w http.ResponseWriter, r *http.Request) {
		const page = 500
		from := 0
		if c := r.URL.Query().Get("continue"); c != "" {
			from, _ = strconv.Atoi(c)
		}
		to := min(from+page, len(repos))
		out := provisioningapis.RepositoryList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioningapis.APIVERSION, Kind: "RepositoryList"},
			ListMeta: metav1.ListMeta{ResourceVersion: "1900000000000000000"},
		}
		for _, repo := range repos[from:to] {
			out.Items = append(out.Items, *repo)
		}
		if to < len(repos) {
			out.Continue = strconv.Itoa(to)
		}
		write(w, out)
	})

	b.srv = httptest.NewServer(mux)
	t.Cleanup(b.srv.Close)
	return b
}

// report attributes the server's counters to one operation.
func (b *benchServer) report(tb *testing.B) {
	tb.ReportMetric(float64(b.requests.Load())/float64(tb.N), "reqs/op")
	tb.ReportMetric(float64(b.bytes.Load())/float64(tb.N), "wire-B/op")
}

func (b *benchServer) clients(t testing.TB) (versioned.Interface, rest.Interface) {
	t.Helper()
	// The operator's clients disable client-side throttling
	// (flowcontrol.NewFakeAlwaysRateLimiter in ControllerConfig), so the
	// benchmark must too. Left at the client-go defaults of 5 QPS and burst 10,
	// every read-back past the tenth serializes at 200ms and the measurement
	// says nothing about the transport.
	cs, err := versioned.NewForConfig(&rest.Config{
		Host: b.srv.URL, RateLimiter: flowcontrol.NewFakeAlwaysRateLimiter(),
	})
	require.NoError(t, err)

	gvr := provisioningapis.RepositoryResourceInfo.GroupVersionResource()
	gv := gvr.GroupVersion()
	rc, err := rest.RESTClientFor(&rest.Config{
		Host: b.srv.URL, APIPath: "/apis",
		ContentConfig: rest.ContentConfig{GroupVersion: &gv, NegotiatedSerializer: scheme.Codecs.WithoutConversion()},
		RateLimiter:   flowcontrol.NewFakeAlwaysRateLimiter(),
	})
	require.NoError(t, err)
	return cs, rc
}

// seedStore fills a snapshot with every repository, then drifts the first
// driftCount of them so the next re-list has to read exactly those back.
func seedStore(ctx context.Context, repos []*provisioningapis.Repository, driftCount int) usinformer.Store {
	store := usinformer.NewStore()
	for i, repo := range repos {
		rv := repo.ResourceVersion
		if i < driftCount {
			rv = "1" // stale, so the key reads as changed
		}
		store.Update(ctx, &provisioningapis.Repository{ObjectMeta: metav1.ObjectMeta{
			Namespace: repo.Namespace, Name: repo.Name, ResourceVersion: rv,
		}})
	}
	return store
}

// BenchmarkRelistStrategies measures the two strategies directly, without the
// read-back limit in the way. This is where the limit's numbers come from, so it
// has to stay independent of the limit: running the shipped re-list instead
// would make the expensive cases fall back to a list and quietly stop measuring
// the thing being compared.
//
// full-list is one paged LIST of the whole snapshot. keys+readback is one keys
// list plus drift sequential object reads, which is what the re-list does for a
// snapshot that has drifted by that much.
func BenchmarkRelistStrategies(b *testing.B) {
	ctx := context.Background()

	for _, rtt := range []time.Duration{0, time.Millisecond} {
		// Small snapshots decide the floor, large ones decide the share, so both
		// ends are measured at the change rates that bracket the crossover.
		for _, c := range []struct {
			total  int
			drifts []int
		}{
			{total: 10, drifts: []int{1, 2, 3, 4, 5, 6, 8, 10}},
			{total: 32, drifts: []int{1, 2, 4, 6, 8, 12}},
			{total: 100, drifts: []int{1, 4, 8, 16, 32}},
			{total: 1000, drifts: []int{1, 16, 31, 64, 128, 256}},
		} {
			repos := make([]*provisioningapis.Repository, c.total)
			for i := range repos {
				repos[i] = benchRepo(i)
			}

			b.Run(fmt.Sprintf("rtt=%v/n=%d/full-list", rtt, c.total), func(b *testing.B) {
				srv := newBenchServer(b, repos, rtt)
				cs, _ := srv.clients(b)
				api := cs.ProvisioningV0alpha1()
				b.ResetTimer()
				for b.Loop() {
					_, _, err := listAllPages(ctx, func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
						return api.Repositories("").List(ctx, opts)
					})
					if err != nil {
						b.Fatal(err)
					}
				}
				b.StopTimer()
				srv.report(b)
			})

			for _, drift := range c.drifts {
				b.Run(fmt.Sprintf("rtt=%v/n=%d/keys+readback=%d", rtt, c.total, drift), func(b *testing.B) {
					srv := newBenchServer(b, repos, rtt)
					cs, rc := srv.clients(b)
					api := cs.ProvisioningV0alpha1()
					keys := keysapi.NewHTTPLister(rc, provisioningapis.RepositoryResourceInfo.GroupVersionResource())
					b.ResetTimer()
					for b.Loop() {
						_, seq := keys.ListKeys(ctx)
						read := 0
						for k, err := range seq {
							if err != nil {
								b.Fatal(err)
							}
							if read >= drift {
								continue // carried forward from the snapshot, costs nothing
							}
							read++
							if _, err := api.Repositories(k.Namespace).Get(ctx, k.Name, metav1.GetOptions{}); err != nil {
								b.Fatal(err)
							}
						}
					}
					b.StopTimer()
					srv.report(b)
				})
			}
		}
	}
}

// BenchmarkRepositoryRelistPolicy exercises the shipped re-list, limit included.
// It does not establish the crossover -- BenchmarkRelistStrategies does -- it
// shows what the limit decides: reqs/op stays at a keys list plus the drift until
// the limit trips, then drops to the LIST pages.
func BenchmarkRepositoryRelistPolicy(b *testing.B) {
	for _, total := range []int{100, 1000} {
		repos := make([]*provisioningapis.Repository, total)
		for i := range repos {
			repos[i] = benchRepo(i)
		}
		limit := maxHydrations(total)

		for _, drift := range []int{0, 1, limit, limit + 1, total} {
			b.Run(fmt.Sprintf("n=%d/drift=%d/limit=%d", total, drift, limit), func(b *testing.B) {
				srv := newBenchServer(b, repos, 0)
				cs, rc := srv.clients(b)
				keys := keysapi.NewHTTPLister(rc, provisioningapis.RepositoryResourceInfo.GroupVersionResource())
				store := seedStore(context.Background(), repos, drift)
				list := repositoryList(cs.ProvisioningV0alpha1(), "", keys, store, RelistRecorder{})
				b.ResetTimer()
				for b.Loop() {
					if _, _, err := list(context.Background()); err != nil {
						b.Fatal(err)
					}
				}
				b.StopTimer()
				srv.report(b)
			})
		}
	}
}

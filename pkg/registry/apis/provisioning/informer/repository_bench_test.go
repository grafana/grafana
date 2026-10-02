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
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/util/flowcontrol"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	keysapi "github.com/grafana/grafana/pkg/registry/apis/keys"
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

// BenchmarkRepositoryRelist compares one full list against the keys projection
// plus per-key read-backs, at the repository counts and change rates a tick
// actually sees. rtt=0 is loopback; rtt=1ms is the order of a same-cluster
// apiserver hop, where each read-back costs a round trip and the list costs one.
func BenchmarkRepositoryRelist(b *testing.B) {
	for _, rtt := range []time.Duration{0, time.Millisecond} {
		for _, total := range []int{10, 100, 1000} {
			repos := make([]*provisioningapis.Repository, total)
			for i := range repos {
				repos[i] = benchRepo(i)
			}

			b.Run(fmt.Sprintf("rtt=%v/n=%d/full-list", rtt, total), func(b *testing.B) {
				srv := newBenchServer(b, repos, rtt)
				cs, _ := srv.clients(b)
				list := repositoryList(cs.ProvisioningV0alpha1(), "", nil, usinformer.NewStore(), RelistRecorder{})
				b.ResetTimer()
				for b.Loop() {
					if _, _, err := list(context.Background()); err != nil {
						b.Fatal(err)
					}
				}
				b.StopTimer()
				b.ReportMetric(float64(srv.requests.Load())/float64(b.N), "reqs/op")
				b.ReportMetric(float64(srv.bytes.Load())/float64(b.N), "wire-B/op")
			})

			for _, pct := range []int{0, 1, 5, 25, 100} {
				drift := total * pct / 100
				if pct == 1 {
					drift = 1 // one changed repository, the steady-state case
				}
				b.Run(fmt.Sprintf("rtt=%v/n=%d/keys-drift=%d", rtt, total, drift), func(b *testing.B) {
					srv := newBenchServer(b, repos, rtt)
					cs, rc := srv.clients(b)
					keys := keysapi.NewHTTPLister(rc, provisioningapis.RepositoryResourceInfo.GroupVersionResource())
					// Seeded once: the re-list only reads the snapshot, so keeping
					// it out of the loop leaves the allocations attributable to
					// the re-list itself.
					store := seedStore(context.Background(), repos, drift)
					list := repositoryList(cs.ProvisioningV0alpha1(), "", keys, store, RelistRecorder{})
					b.ResetTimer()
					for b.Loop() {
						if _, _, err := list(context.Background()); err != nil {
							b.Fatal(err)
						}
					}
					b.StopTimer()
					b.ReportMetric(float64(srv.requests.Load())/float64(b.N), "reqs/op")
					b.ReportMetric(float64(srv.bytes.Load())/float64(b.N), "wire-B/op")
				})
			}
		}
	}
}

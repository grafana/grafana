package features

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
)

func TestParseWatchRequest(t *testing.T) {
	userid := "userid" // dummy
	tests := []struct {
		testCase string
		channel  string
		userid   string // override

		// Expect
		gvr  schema.GroupVersionResource
		name string
		err  bool
	}{
		{
			testCase: "dashbaords",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards/userid",
			gvr: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
		},
		{
			testCase: "dashbaords with anme",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards=abc/userid",
			gvr: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			name: "abc",
		},
		{
			testCase: "bad user id",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards/x",
			err:      true, // bad user id
		},
	}
	for _, tt := range tests {
		t.Run(tt.testCase, func(t *testing.T) {
			gvr, name, err := parseWatchRequest(tt.channel, first(tt.userid, userid))
			if tt.err {
				require.Error(t, err)
				return
			}
			require.Equal(t, tt.gvr, gvr)
			require.Equal(t, tt.name, name)
		})
	}
}

func first(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// --- harness ---------------------------------------------------------------

var testGVR = schema.GroupVersionResource{
	Group:    provisioning.GROUP,
	Version:  "v0alpha1",
	Resource: "repositories",
}

// fakeSubscribers is a mutable local-presence stub: tests set the count per
// full (namespace-prefixed) channel to drive the watcher's idle polling.
type fakeSubscribers struct {
	mu    sync.Mutex
	count map[string]int
	err   error
}

func newFakeSubscribers() *fakeSubscribers {
	return &fakeSubscribers{count: map[string]int{}}
}

func (f *fakeSubscribers) GetNumLocalSubscribers(channel string) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return 0, f.err
	}
	return f.count[channel], nil
}

func (f *fakeSubscribers) set(channel string, n int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.count[channel] = n
}

type publication struct {
	ns      string
	channel string
}

// recordingPublisher captures every publish so a test can assert which channels
// an event reached.
type recordingPublisher struct {
	mu   sync.Mutex
	got  []publication
	errs map[string]error
}

func newRecordingPublisher() *recordingPublisher {
	return &recordingPublisher{errs: map[string]error{}}
}

func (p *recordingPublisher) publish(ns string, channel string, _ []byte) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.got = append(p.got, publication{ns: ns, channel: channel})
	return p.errs[channel]
}

func (p *recordingPublisher) channels() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	out := make([]string, 0, len(p.got))
	for _, g := range p.got {
		out = append(out, g.channel)
	}
	return out
}

func (p *recordingPublisher) failOn(channel string, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.errs[channel] = err
}

// fakeWatches hands out a watch.FakeWatcher per Watch call and records the
// namespaces and identities they were opened for, so tests can count upstream
// streams and assert who they run as.
type fakeWatches struct {
	mu         sync.Mutex
	created    []*watch.FakeWatcher
	namespaces []string
	// resourceVersions records what each watch was opened at, in order.
	resourceVersions []string
	watchers         []identity.Requester
	listers          []identity.Requester
	err              error
	listErr          func(uid string) error
}

func (f *fakeWatches) client(t *testing.T) func(context.Context) (dynamic.Interface, error) {
	t.Helper()
	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(testGVR.GroupVersion().WithKind("Repository"), &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(testGVR.GroupVersion().WithKind("RepositoryList"), &unstructured.UnstructuredList{})

	return func(context.Context) (dynamic.Interface, error) {
		c := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, map[schema.GroupVersionResource]string{
			testGVR: "RepositoryList",
		})
		c.PrependWatchReactor("*", func(action k8stesting.Action) (bool, watch.Interface, error) {
			f.mu.Lock()
			defer f.mu.Unlock()
			if f.err != nil {
				return true, nil, f.err
			}
			w := watch.NewFake()
			f.created = append(f.created, w)
			f.namespaces = append(f.namespaces, action.GetNamespace())
			if watchAction, ok := action.(k8stesting.WatchAction); ok {
				f.resourceVersions = append(f.resourceVersions, watchAction.GetWatchRestrictions().ResourceVersion)
			}
			return true, w, nil
		})
		return recordingClient{Interface: c, watches: f}, nil
	}
}

// recordingClient captures the identity each List and Watch call carries. The
// client-go fake passes reactors an Action without a context, so the identity
// has to be read at the call itself.
type recordingClient struct {
	dynamic.Interface
	watches *fakeWatches
}

func (c recordingClient) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	return recordingNamespaceable{NamespaceableResourceInterface: c.Interface.Resource(gvr), watches: c.watches}
}

type recordingNamespaceable struct {
	dynamic.NamespaceableResourceInterface
	watches *fakeWatches
}

func (c recordingNamespaceable) Namespace(ns string) dynamic.ResourceInterface {
	return recordingResource{ResourceInterface: c.NamespaceableResourceInterface.Namespace(ns), watches: c.watches}
}

type recordingResource struct {
	dynamic.ResourceInterface
	watches *fakeWatches
}

func (c recordingResource) List(ctx context.Context, opts v1.ListOptions) (*unstructured.UnstructuredList, error) {
	requester, _ := identity.GetRequester(ctx)

	c.watches.mu.Lock()
	c.watches.listers = append(c.watches.listers, requester)
	listErr := c.watches.listErr
	c.watches.mu.Unlock()

	if listErr != nil && requester != nil {
		if err := listErr(requester.GetIdentifier()); err != nil {
			return nil, err
		}
	}
	return c.ResourceInterface.List(ctx, opts)
}

func (c recordingResource) Watch(ctx context.Context, opts v1.ListOptions) (watch.Interface, error) {
	requester, _ := identity.GetRequester(ctx)

	c.watches.mu.Lock()
	c.watches.watchers = append(c.watches.watchers, requester)
	c.watches.mu.Unlock()

	return c.ResourceInterface.Watch(ctx, opts)
}

func (f *fakeWatches) lastWatcher() identity.Requester {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.watchers[len(f.watchers)-1]
}

func (f *fakeWatches) listIdentities() []identity.Requester {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]identity.Requester(nil), f.listers...)
}

func (f *fakeWatches) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.created)
}

func (f *fakeWatches) at(i int) *watch.FakeWatcher {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.created[i]
}

func testRequester(uid, namespace string) identity.Requester {
	return &identity.StaticRequester{
		Type:      types.TypeUser,
		UserUID:   uid,
		Namespace: namespace,
		OrgID:     1,
	}
}

type testRunner struct {
	*WatchRunner
	watches    *fakeWatches
	publisher  *recordingPublisher
	subscriber *fakeSubscribers
}

func newTestRunner(t *testing.T) *testRunner {
	t.Helper()
	watches := &fakeWatches{}
	publisher := newRecordingPublisher()
	subscribers := newFakeSubscribers()

	r := NewWatchRunner(publisher.publish, subscribers, apiserver.WithoutRestConfig)
	r.newClient = watches.client(t)
	// Keep the lifecycle poll fast enough for tests to observe it.
	r.checkInterval = 5 * time.Millisecond

	t.Cleanup(func() {
		r.watchingMu.Lock()
		watchers := make([]*watcher, 0, len(r.watching))
		for _, w := range r.watching {
			watchers = append(watchers, w)
		}
		r.watchingMu.Unlock()
		for _, w := range watchers {
			w.cancel()
		}
	})

	return &testRunner{WatchRunner: r, watches: watches, publisher: publisher, subscriber: subscribers}
}

// channelFor builds the stripped channel for a user, matching what Live hands
// OnSubscribe after StripK8sNamespace.
func channelFor(uid string) string {
	return "watch/" + provisioning.GROUP + "/v0alpha1/repositories/" + uid
}

func (r *testRunner) subscribe(t *testing.T, u identity.Requester, channel string) (backend.SubscribeStreamStatus, error) {
	t.Helper()
	_, status, err := r.OnSubscribe(t.Context(), u, model.SubscribeEvent{Channel: channel})
	return status, err
}

func (r *testRunner) watcherCount() int {
	r.watchingMu.Lock()
	defer r.watchingMu.Unlock()
	return len(r.watching)
}

// --- tests -----------------------------------------------------------------

func TestOnSubscribe_AuthorizationRunsBeforeReuse(t *testing.T) {
	t.Run("a uid that only suffix-matches cannot attach to another user's watcher", func(t *testing.T) {
		r := newTestRunner(t)
		victim := testRequester("au1", "default")
		attacker := testRequester("u1", "default")

		status, err := r.subscribe(t, victim, channelFor("au1"))
		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusOK, status)
		require.Equal(t, 1, r.watches.count())

		// The attacker's uid is a string suffix of the victim's channel, which the
		// old HasSuffix check accepted before the reuse short-circuit.
		status, err = r.subscribe(t, attacker, channelFor("au1"))
		require.Error(t, err)
		require.Equal(t, backend.SubscribeStreamStatusNotFound, status)
		require.Equal(t, 1, r.watcherCount(), "attacker must not have joined or created a watcher")
	})

	t.Run("group gate runs on the reuse path too", func(t *testing.T) {
		r := newTestRunner(t)
		u := testRequester("u1", "default")

		status, err := r.subscribe(t, u, "watch/dashboard.grafana.app/v0alpha1/dashboards/u1")
		require.Error(t, err)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
		require.Equal(t, 0, r.watches.count())
	})
}

func TestOnSubscribe_NamespaceIsPartOfTheKey(t *testing.T) {
	r := newTestRunner(t)
	channel := channelFor("u1")

	// Same user uid, same stripped channel, two orgs: the namespace is what tells
	// the two subscriptions apart.
	_, err := r.subscribe(t, testRequester("u1", "default"), channel)
	require.NoError(t, err)
	_, err = r.subscribe(t, testRequester("u1", "org-2"), channel)
	require.NoError(t, err)

	require.Equal(t, 2, r.watcherCount())
	require.Equal(t, 2, r.watches.count())
	require.ElementsMatch(t, []string{"default", "org-2"}, r.watches.namespaces)

	r.watches.at(0).Add(&unstructured.Unstructured{})
	r.watches.at(1).Add(&unstructured.Unstructured{})

	require.Eventually(t, func() bool {
		r.publisher.mu.Lock()
		defer r.publisher.mu.Unlock()
		return len(r.publisher.got) == 2
	}, time.Second, 5*time.Millisecond)

	r.publisher.mu.Lock()
	defer r.publisher.mu.Unlock()
	require.ElementsMatch(t, []publication{
		{ns: "default", channel: channel},
		{ns: "org-2", channel: channel},
	}, r.publisher.got)
}

func TestWatcherLifecycle(t *testing.T) {
	t.Run("stops and unregisters once no local subscribers remain", func(t *testing.T) {
		r := newTestRunner(t)
		u := testRequester("u1", "default")
		channel := channelFor("u1")
		full := orgchannel.PrependK8sNamespace("default", channel)

		r.subscriber.set(full, 1)
		_, err := r.subscribe(t, u, channel)
		require.NoError(t, err)

		// Stays alive while subscribers are present.
		require.Never(t, func() bool { return r.watcherCount() == 0 }, 50*time.Millisecond, 5*time.Millisecond)

		r.subscriber.set(full, 0)
		require.Eventually(t, func() bool { return r.watcherCount() == 0 }, time.Second, 5*time.Millisecond)
		require.True(t, r.watches.at(0).IsStopped(), "upstream watch must be stopped")
	})

	t.Run("a subscriber returning before the grace period keeps the watch", func(t *testing.T) {
		r := newTestRunner(t)
		u := testRequester("u1", "default")
		channel := channelFor("u1")
		full := orgchannel.PrependK8sNamespace("default", channel)

		_, err := r.subscribe(t, u, channel)
		require.NoError(t, err)

		// Zero for one poll, then back: the counter must re-arm rather than latch.
		time.Sleep(10 * time.Millisecond)
		r.subscriber.set(full, 1)
		require.Never(t, func() bool { return r.watcherCount() == 0 }, 50*time.Millisecond, 5*time.Millisecond)
	})

	t.Run("a broken upstream stream unregisters the watcher", func(t *testing.T) {
		r := newTestRunner(t)
		r.checkInterval = time.Hour // only the stream break may end this watcher
		u := testRequester("u1", "default")

		_, err := r.subscribe(t, u, channelFor("u1"))
		require.NoError(t, err)

		r.watches.at(0).Stop()
		require.Eventually(t, func() bool { return r.watcherCount() == 0 }, time.Second, 5*time.Millisecond)
	})

	t.Run("a stopped watcher is replaced rather than reused", func(t *testing.T) {
		r := newTestRunner(t)
		r.checkInterval = time.Hour
		u := testRequester("u1", "default")
		channel := channelFor("u1")

		_, err := r.subscribe(t, u, channel)
		require.NoError(t, err)
		first := r.watches.at(0)
		first.Stop()
		require.Eventually(t, func() bool { return r.watcherCount() == 0 }, time.Second, 5*time.Millisecond)

		_, err = r.subscribe(t, u, channel)
		require.NoError(t, err)
		require.Equal(t, 2, r.watches.count())
		require.Equal(t, 1, r.watcherCount())
	})

	t.Run("a failing publish drops the watcher", func(t *testing.T) {
		r := newTestRunner(t)
		r.checkInterval = time.Hour
		u := testRequester("u1", "default")
		channel := channelFor("u1")

		_, err := r.subscribe(t, u, channel)
		require.NoError(t, err)

		r.publisher.failOn(channel, errors.New("broken"))
		r.watches.at(0).Add(&unstructured.Unstructured{})
		require.Eventually(t, func() bool { return r.watcherCount() == 0 }, time.Second, 5*time.Millisecond)
	})
}

func TestOnSubscribe_ForbiddenSurfacesAsPermissionDenied(t *testing.T) {
	for _, tt := range []struct {
		name string
		err  error
		want backend.SubscribeStreamStatus
	}{
		{
			name: "forbidden",
			err:  apierrors.NewForbidden(testGVR.GroupResource(), "", errors.New("nope")),
			want: backend.SubscribeStreamStatusPermissionDenied,
		},
		{
			name: "unauthorized",
			err:  apierrors.NewUnauthorized("nope"),
			want: backend.SubscribeStreamStatusPermissionDenied,
		},
		{
			name: "anything else stays a channel error",
			err:  errors.New("boom"),
			want: backend.SubscribeStreamStatusNotFound,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			r := newTestRunner(t)
			r.watches.err = tt.err

			status, err := r.subscribe(t, testRequester("u1", "default"), channelFor("u1"))
			require.Error(t, err)
			require.Equal(t, tt.want, status)
			require.Equal(t, 0, r.watcherCount())
		})
	}
}

// --- shared watch (provisioning.sharedLiveWatch) ---------------------------

// openfeatureTestMutex serializes the process-wide OpenFeature provider the
// toggle is read from.
var openfeatureTestMutex sync.Mutex

func enableSharedWatch(t *testing.T, enabled bool) {
	t.Helper()
	openfeatureTestMutex.Lock()
	flag := featuremgmt.FlagProvisioningSharedLiveWatch
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		flag: {Key: flag, DefaultVariant: "default", Variants: map[string]any{"default": enabled}},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		// Not require.NoError: a FailNow here would skip the unlock and deadlock
		// the rest of the package.
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

func TestSharedWatch(t *testing.T) {
	t.Run("one upstream watch serves every subscriber", func(t *testing.T) {
		enableSharedWatch(t, true)
		r := newTestRunner(t)
		r.checkInterval = time.Hour

		for _, uid := range []string{"u1", "u2"} {
			status, err := r.subscribe(t, testRequester(uid, "default"), channelFor(uid))
			require.NoError(t, err)
			require.Equal(t, backend.SubscribeStreamStatusOK, status)
		}

		require.Equal(t, 1, r.watches.count(), "both users must share one apiserver watch")
		require.Equal(t, 1, r.watcherCount())

		r.watches.at(0).Add(&unstructured.Unstructured{})
		require.Eventually(t, func() bool {
			return len(r.publisher.channels()) == 2
		}, time.Second, 5*time.Millisecond)
		require.ElementsMatch(t, []string{channelFor("u1"), channelFor("u2")}, r.publisher.channels())
	})

	t.Run("the shared watch runs as the service, scoped to the namespace", func(t *testing.T) {
		enableSharedWatch(t, true)
		r := newTestRunner(t)
		r.checkInterval = time.Hour

		_, err := r.subscribe(t, testRequester("u1", "stacks-7"), channelFor("u1"))
		require.NoError(t, err)

		watcher := r.watches.lastWatcher()
		require.NotNil(t, watcher)
		require.Equal(t, types.TypeAccessPolicy, watcher.GetIdentityType(), "watch must not run as the user")
		require.Equal(t, "stacks-7", watcher.GetNamespace(), "watch must stay inside the subscriber's namespace")

		// The authorization probe, by contrast, has to be the user.
		listers := r.watches.listIdentities()
		require.Len(t, listers, 1)
		require.Equal(t, "u1", listers[0].GetIdentifier())
		require.Equal(t, types.TypeUser, listers[0].GetIdentityType())
	})

	t.Run("a user who cannot read the resource is denied and does not attach", func(t *testing.T) {
		enableSharedWatch(t, true)
		r := newTestRunner(t)
		r.checkInterval = time.Hour
		r.watches.listErr = func(uid string) error {
			if uid == "u2" {
				return apierrors.NewForbidden(testGVR.GroupResource(), "", errors.New("no read"))
			}
			return nil
		}

		_, err := r.subscribe(t, testRequester("u1", "default"), channelFor("u1"))
		require.NoError(t, err)
		require.Equal(t, 1, r.watcherCount())

		status, err := r.subscribe(t, testRequester("u2", "default"), channelFor("u2"))
		require.Error(t, err)
		require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
		require.Equal(t, 1, r.watcherCount(), "the denied user must not create a watcher")

		// And the denied user must not be published to.
		r.watches.at(0).Add(&unstructured.Unstructured{})
		require.Eventually(t, func() bool {
			return len(r.publisher.channels()) == 1
		}, time.Second, 5*time.Millisecond)
		require.Equal(t, []string{channelFor("u1")}, r.publisher.channels())
	})

	t.Run("authorization is re-checked when attaching to an existing watcher", func(t *testing.T) {
		enableSharedWatch(t, true)
		r := newTestRunner(t)
		r.checkInterval = time.Hour
		u := testRequester("u1", "default")

		_, err := r.subscribe(t, u, channelFor("u1"))
		require.NoError(t, err)
		_, err = r.subscribe(t, u, channelFor("u1"))
		require.NoError(t, err)

		require.Equal(t, 1, r.watches.count())
		require.Len(t, r.watches.listIdentities(), 2, "the probe must run on the attach path too")
	})

	t.Run("a subscriber leaving drops only its own channel", func(t *testing.T) {
		enableSharedWatch(t, true)
		r := newTestRunner(t)

		for _, uid := range []string{"u1", "u2"} {
			r.subscriber.set(orgchannel.PrependK8sNamespace("default", channelFor(uid)), 1)
			_, err := r.subscribe(t, testRequester(uid, "default"), channelFor(uid))
			require.NoError(t, err)
		}
		require.Equal(t, 1, r.watcherCount())

		r.subscriber.set(orgchannel.PrependK8sNamespace("default", channelFor("u2")), 0)
		require.Eventually(t, func() bool {
			r.watchingMu.Lock()
			defer r.watchingMu.Unlock()
			for _, w := range r.watching {
				return len(w.channelList()) == 1
			}
			return false
		}, time.Second, 5*time.Millisecond)

		require.Equal(t, 1, r.watcherCount(), "the remaining subscriber keeps the watch open")

		r.watches.at(0).Add(&unstructured.Unstructured{})
		require.Eventually(t, func() bool {
			return len(r.publisher.channels()) == 1
		}, time.Second, 5*time.Millisecond)
		require.Equal(t, []string{channelFor("u1")}, r.publisher.channels())
	})

	t.Run("with the toggle off each subscriber gets its own watch, as its own identity", func(t *testing.T) {
		enableSharedWatch(t, false)
		r := newTestRunner(t)
		r.checkInterval = time.Hour

		for _, uid := range []string{"u1", "u2"} {
			_, err := r.subscribe(t, testRequester(uid, "default"), channelFor(uid))
			require.NoError(t, err)
		}

		require.Equal(t, 2, r.watches.count())
		require.Equal(t, 2, r.watcherCount())
		require.Empty(t, r.watches.listIdentities(), "no probe when the apiserver authorizes each stream")
		require.Equal(t, types.TypeUser, r.watches.lastWatcher().GetIdentityType())
		require.Equal(t, "u2", r.watches.lastWatcher().GetIdentifier())
	})
}

func TestSharedWatch_ResourceVersionOfTheOpeningSubscriber(t *testing.T) {
	enableSharedWatch(t, true)
	r := newTestRunner(t)
	r.checkInterval = time.Hour

	_, _, err := r.OnSubscribe(t.Context(), testRequester("u1", "default"), model.SubscribeEvent{
		Channel: channelFor("u1"),
		Data:    []byte(`{"resourceVersion":"100"}`),
	})
	require.NoError(t, err)

	// The second subscriber attaches to the open stream, so its resourceVersion
	// cannot be honoured - there is no second watch to open at it.
	_, _, err = r.OnSubscribe(t.Context(), testRequester("u2", "default"), model.SubscribeEvent{
		Channel: channelFor("u2"),
		Data:    []byte(`{"resourceVersion":"200"}`),
	})
	require.NoError(t, err)

	require.Equal(t, 1, r.watches.count())
	r.watches.mu.Lock()
	defer r.watches.mu.Unlock()
	require.Equal(t, []string{"100"}, r.watches.resourceVersions)
}

func TestOnSubscribe_AnonymousIsLeftToTheApiserver(t *testing.T) {
	enableSharedWatch(t, true)
	r := newTestRunner(t)
	r.checkInterval = time.Hour

	anonymous := &identity.StaticRequester{Type: types.TypeAnonymous, Namespace: "default"}
	status, err := r.subscribe(t, anonymous, channelFor("anonymous"))
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusOK, status)

	// No hardcoded deny: the probe runs as the anonymous identity and the
	// apiserver is what decides.
	listers := r.watches.listIdentities()
	require.Len(t, listers, 1)
	require.Equal(t, types.TypeAnonymous, listers[0].GetIdentityType())
}

func TestWatcherLifecycle_PresenceErrorKeepsTheWatch(t *testing.T) {
	r := newTestRunner(t)
	_, err := r.subscribe(t, testRequester("u1", "default"), channelFor("u1"))
	require.NoError(t, err)

	// A presence lookup failing is not evidence that nobody is listening.
	r.subscriber.mu.Lock()
	r.subscriber.err = errors.New("presence unavailable")
	r.subscriber.mu.Unlock()

	require.Never(t, func() bool { return r.watcherCount() == 0 }, 60*time.Millisecond, 5*time.Millisecond)
}

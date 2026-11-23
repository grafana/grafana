package informers

import (
	"context"
	"errors"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
)

var testGVR = schema.GroupVersionResource{Group: "test.grafana.app", Version: "v1", Resource: "things"}

var testKind = resource.Kind{
	Schema: resource.NewSimpleSchema(testGVR.Group, testGVR.Version, &resource.UntypedObject{}, &resource.UntypedList{},
		resource.WithKind("Thing"), resource.WithPlural(testGVR.Resource)),
	Codecs: map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()},
}

func natsCfg(enabled bool) *setting.Cfg {
	return &setting.Cfg{NATS: setting.NATSSettings{Enabled: enabled}}
}

// namedSource is a DeltaSource that only says which mechanism built it.
type namedSource string

func (namedSource) AddEventHandler(cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	return nil, nil
}
func (namedSource) Run(<-chan struct{}) {}

func allSources(needs operator.WatchOptions) Sources {
	return Sources{
		GVR:              testGVR,
		Needs:            needs,
		Watch:            func() DeltaSource { return namedSource("watch") },
		ReList:           func() DeltaSource { return namedSource("relist") },
		NotifyWithReList: func(nats.Subscriber) DeltaSource { return namedSource("notify") },
	}
}

var resyncOnly = operator.WatchOptions{Resync: &operator.WatchResyncOptions{}}

func TestSelector_Source(t *testing.T) {
	for _, tc := range []struct {
		name     string
		selector *Selector
		sources  Sources
		want     namedSource
	}{
		{name: "nil selector gives the watch", selector: nil, sources: allSources(KeyedNeeds), want: "watch"},
		{name: "NATS off gives the watch", selector: ProvideSelector(natsCfg(false), nil), sources: allSources(KeyedNeeds), want: "watch"},
		{name: "keyed controller takes NATS notifications", selector: ProvideSelector(natsCfg(true), enabledSubscriber{}), sources: allSources(KeyedNeeds), want: "notify"},
		{name: "keyed controller skips the re-list, which has no live channel", selector: ProvideSelector(natsCfg(true), nil), sources: allSources(KeyedNeeds), want: "watch"},
		{name: "resync-only controller takes the cheaper re-list", selector: ProvideSelector(natsCfg(true), enabledSubscriber{}), sources: allSources(resyncOnly), want: "relist"},
		{name: "default needs (whole objects to every replica) take the watch", selector: ProvideSelector(natsCfg(true), enabledSubscriber{}), sources: allSources(operator.WatchOptions{}), want: "watch"},
		{
			name:     "a mechanism the controller has no source for is not offered",
			selector: ProvideSelector(natsCfg(true), enabledSubscriber{}),
			sources:  Sources{GVR: testGVR, Needs: resyncOnly, Watch: func() DeltaSource { return namedSource("watch") }},
			want:     "watch",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.selector.Source(tc.sources)
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestSelector_Source_Errors(t *testing.T) {
	t.Run("requires the watch to fall back to", func(t *testing.T) {
		_, err := (*Selector)(nil).Source(Sources{GVR: testGVR})
		assert.Error(t, err)
	})

	t.Run("fails when even the watch provides less than needed", func(t *testing.T) {
		sharded := operator.WatchOptions{Live: &operator.WatchLiveOptions{Distribution: operator.WatchDistributionSharded}}
		_, err := ProvideSelector(natsCfg(true), enabledSubscriber{}).Source(allSources(sharded))
		assert.Error(t, err)
	})
}

func TestSelector_Supplier(t *testing.T) {
	needing := func(needs operator.WatchOptions) operator.InformerOptions {
		return operator.InformerOptions{WatchNeeds: needs, CacheResyncInterval: time.Minute}
	}

	t.Run("resync-only kind gets the re-list informer", func(t *testing.T) {
		inf, err := ProvideSelector(natsCfg(true), enabledSubscriber{}).Supplier()(testKind, fakeClients{client: &pagedClient{}}, needing(resyncOnly))
		require.NoError(t, err)
		provides, ok := operator.InformerWatchOptions(inf)
		require.True(t, ok)
		assert.Equal(t, ReList, provides)
	})

	t.Run("keyed kind selects the NATS mechanism, which has no SDK informer yet", func(t *testing.T) {
		_, err := ProvideSelector(natsCfg(true), enabledSubscriber{}).Supplier()(testKind, fakeClients{}, needing(KeyedNeeds))
		assert.ErrorIs(t, err, errNotImplemented)
	})

	t.Run("without NATS every kind falls back to the API watch", func(t *testing.T) {
		errNoClient := errors.New("no client")
		_, err := ProvideSelector(natsCfg(false), nil).Supplier()(testKind, fakeClients{err: errNoClient}, needing(KeyedNeeds))
		assert.ErrorIs(t, err, errNoClient, "expected the fallback, which asks for a client, to be reached")
	})
}

func TestReListInformer_DeliversEveryPageOnEachPass(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := &pagedClient{pages: [][]string{{"a", "b"}, {"c"}}}
		inf, err := newReListInformer(testKind, fakeClients{client: client}, operator.InformerOptions{
			WatchNeeds: operator.WatchOptions{Resync: &operator.WatchResyncOptions{Interval: time.Minute, ListPageSize: 2}},
		})
		require.NoError(t, err)

		var mu sync.Mutex
		var got []string
		require.NoError(t, inf.AddEventHandler(&operator.SimpleWatcher{AddFunc: func(_ context.Context, obj resource.Object) error {
			mu.Lock()
			defer mu.Unlock()
			got = append(got, obj.GetName())
			return nil
		}}))

		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		go func() { _ = inf.Run(ctx) }()

		require.NoError(t, inf.WaitForSync(ctx))
		mu.Lock()
		assert.Equal(t, []string{"a", "b", "c"}, got)
		mu.Unlock()

		time.Sleep(time.Minute)
		synctest.Wait()
		mu.Lock()
		assert.Equal(t, []string{"a", "b", "c", "a", "b", "c"}, got)
		mu.Unlock()
		assert.Equal(t, 2, client.limit)
	})
}

func TestReListInformer_RequiresAnInterval(t *testing.T) {
	_, err := newReListInformer(testKind, fakeClients{client: &pagedClient{}}, operator.InformerOptions{WatchNeeds: resyncOnly})
	assert.Error(t, err)
}

type enabledSubscriber struct{ nats.Subscriber }

func (enabledSubscriber) Enabled() bool { return true }

type fakeClients struct {
	resource.ClientGenerator
	client resource.Client
	err    error
}

func (f fakeClients) ClientFor(resource.Kind) (resource.Client, error) {
	return f.client, f.err
}

// pagedClient serves pages of objects by name, one page per List call, using the
// page index as the continue token.
type pagedClient struct {
	resource.Client
	pages [][]string
	limit int
}

func (c *pagedClient) List(_ context.Context, _ string, opts resource.ListOptions) (resource.ListObject, error) {
	c.limit = opts.Limit
	page := 0
	if opts.Continue != "" {
		page = int(opts.Continue[0] - '0')
	}
	list := &resource.UntypedList{}
	if page >= len(c.pages) {
		return list, nil
	}
	for _, name := range c.pages[page] {
		list.Items = append(list.Items, &resource.UntypedObject{ObjectMeta: metav1.ObjectMeta{Name: name}})
	}
	if page+1 < len(c.pages) {
		list.Continue = string(rune('0' + page + 1))
	}
	return list, nil
}

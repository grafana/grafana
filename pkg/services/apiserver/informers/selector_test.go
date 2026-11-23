package informers

import (
	"context"
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

	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/setting"
)

var testGVR = schema.GroupVersionResource{Group: "test.grafana.app", Version: "v1", Resource: "things"}

var testKind = UntypedKind(testGVR, "Thing")

var resyncOnly = operator.WatchOptions{Resync: &operator.WatchResyncOptions{}}

func natsCfg(enabled bool) *setting.Cfg {
	return &setting.Cfg{NATS: setting.NATSSettings{Enabled: enabled}}
}

func TestProvideSupplier(t *testing.T) {
	for _, tc := range []struct {
		name       string
		cfg        *setting.Cfg
		subscriber nats.Subscriber
		needs      operator.WatchOptions
		want       string
	}{
		{name: "without NATS a keyed kind takes the API watch", cfg: natsCfg(false), needs: KeyedNeeds, want: "watch"},
		{name: "without NATS a resync-only kind takes the API watch", cfg: natsCfg(false), needs: resyncOnly, want: "watch"},
		{name: "under NATS a resync-only kind takes the cheaper re-list", cfg: natsCfg(true), subscriber: enabledSubscriber{}, needs: resyncOnly, want: "relist"},
		{name: "under NATS a keyed kind takes the NATS notifications, not implemented yet", cfg: natsCfg(true), subscriber: enabledSubscriber{}, needs: KeyedNeeds, want: "unimplemented"},
		{name: "a keyed kind skips the re-list, which has no live channel", cfg: natsCfg(true), needs: KeyedNeeds, want: "watch"},
		{name: "default needs (whole objects to every replica) take the API watch", cfg: natsCfg(true), subscriber: enabledSubscriber{}, needs: operator.WatchOptions{}, want: "watch"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			inf, err := ProvideSupplier(tc.cfg, tc.subscriber)(testKind, fakeClients{client: &pagedClient{}},
				operator.InformerOptions{WatchNeeds: tc.needs, CacheResyncInterval: time.Minute})
			switch tc.want {
			case "unimplemented":
				assert.ErrorIs(t, err, errNotImplemented)
			case "relist":
				require.NoError(t, err)
				provides, _ := operator.InformerWatchOptions(inf)
				assert.Equal(t, ReList, provides)
			case "watch":
				require.NoError(t, err)
				provides, _ := operator.InformerWatchOptions(inf)
				assert.NotEqual(t, ReList, provides)
			}
		})
	}
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

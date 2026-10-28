package informer

import (
	"context"
	"errors"
	"iter"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

// pagedJobList builds one page of a paginated job LIST: the named jobs plus the
// continue token pointing at the next page (empty on the last page) and the
// snapshot resource version (pinned across pages by the continue token).
func pagedJobList(continueToken, resourceVersion string, names ...string) *provisioningapis.JobList {
	l := &provisioningapis.JobList{
		ListMeta: metav1.ListMeta{Continue: continueToken, ResourceVersion: resourceVersion},
	}
	for _, name := range names {
		l.Items = append(l.Items, provisioningapis.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name},
		})
	}
	return l
}

func TestListAllPages(t *testing.T) {
	tests := []struct {
		name string
		// pages is keyed by the continue token the page func receives; "" is the
		// first call.
		pages      map[string]*provisioningapis.JobList
		errOn      string // continue token whose page fails
		wantNames  []string
		wantListRV int64 // resource version listAllPages reports for the snapshot
		wantErr    bool
		wantCalls  []string // continue tokens received, in order
	}{
		{
			name: "single page",
			pages: map[string]*provisioningapis.JobList{
				"": pagedJobList("", "100", "a", "b"),
			},
			wantNames:  []string{"a", "b"},
			wantListRV: 100,
			wantCalls:  []string{""},
		},
		{
			name: "follows continue tokens across pages",
			pages: map[string]*provisioningapis.JobList{
				"":      pagedJobList("page2", "200", "a", "b"),
				"page2": pagedJobList("page3", "200", "c", "d"),
				"page3": pagedJobList("", "200", "e"),
			},
			wantNames:  []string{"a", "b", "c", "d", "e"},
			wantListRV: 200, // pinned to the first page's version across pages
			wantCalls:  []string{"", "page2", "page3"},
		},
		{
			name: "error on a later page fails the whole list",
			pages: map[string]*provisioningapis.JobList{
				"": pagedJobList("page2", "300", "a", "b"),
			},
			errOn:     "page2",
			wantErr:   true,
			wantCalls: []string{"", "page2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var calls []string
			page := func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
				calls = append(calls, opts.Continue)
				if tt.errOn != "" && opts.Continue == tt.errOn {
					return nil, errors.New("boom")
				}
				l, ok := tt.pages[opts.Continue]
				require.Truef(t, ok, "unexpected continue token %q", opts.Continue)
				return l, nil
			}

			out, listRV, err := listAllPages(context.Background(), page)
			require.Equal(t, tt.wantCalls, calls)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantListRV, listRV)
			names := make([]string, 0, len(out))
			for _, obj := range out {
				job, ok := obj.(*provisioningapis.Job)
				require.True(t, ok)
				names = append(names, job.Name)
			}
			require.Equal(t, tt.wantNames, names)
		})
	}
}

// stubKeysLister serves a canned key stream, optionally ending in an error, so
// the re-list can be driven without a storage backend.
type stubKeysLister struct {
	listRV int64
	keys   []keysapi.Key
	err    error
	called int
}

func (s *stubKeysLister) ListKeys(context.Context) (int64, iter.Seq2[keysapi.Key, error]) {
	s.called++
	return s.listRV, func(yield func(keysapi.Key, error) bool) {
		for _, k := range s.keys {
			if !yield(k, nil) {
				return
			}
		}
		if s.err != nil {
			yield(keysapi.Key{}, s.err)
		}
	}
}

// connectionPage lists connections from a fake client seeded with a single
// connection, so a test can tell the full list from the keys path by name.
func connectionPage(t *testing.T, objs ...runtime.Object) pageFunc {
	t.Helper()
	c := fake.NewClientset(objs...).ProvisioningV0alpha1()
	return func(ctx context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		return c.Connections(testNamespace).List(ctx, opts)
	}
}

func connection(name string) *provisioningapis.Connection {
	return &provisioningapis.Connection{ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: name, ResourceVersion: "7"}}
}

func identities(t *testing.T, objs []runtime.Object) []string {
	t.Helper()
	out := make([]string, 0, len(objs))
	for _, o := range objs {
		id, ok := o.(*metav1.PartialObjectMetadata)
		require.True(t, ok, "expected an identity, got %T", o)
		out = append(out, id.Namespace+"/"+id.Name+"@"+id.ResourceVersion)
	}
	return out
}

func TestIdentityList_KeysOnly(t *testing.T) {
	keys := &stubKeysLister{listRV: 100, keys: []keysapi.Key{
		{Namespace: "ns1", Name: "a", ResourceVersion: "10"},
		{Namespace: "ns2", Name: "b", ResourceVersion: "11"},
	}}

	recorder, reg := newTestRecorder(connGVR)
	objs, listRV, err := identityList(keys, connectionPage(t, connection("from-full-list")), recorder)(t.Context())
	require.NoError(t, err)

	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "keys"), "the tick must report that keys served it")
	assert.Zero(t, projectionCount(t, reg, connGVR, "objects"))
	assert.Equal(t, int64(100), listRV, "the snapshot version the Store arbitrates against")
	assert.Equal(t, []string{"ns1/a@10", "ns2/b@11"}, identities(t, objs), "the Store compares the version to decide what changed")
}

// The setting off, and storage too old for keys_only, both list full objects;
// the Store still gets identities, so what it holds does not depend on the path.
func TestIdentityList_FullObjectsAreProjected(t *testing.T) {
	full := connection("a")
	full.Spec.Title = "a title nobody reading the store needs"

	for name, keys := range map[string]keysapi.Lister{
		"no keys lister":        nil,
		"keys_only unsupported": &stubKeysLister{err: keysapi.ErrUnsupported},
	} {
		t.Run(name, func(t *testing.T) {
			recorder, reg := newTestRecorder(connGVR)
			objs, _, err := identityList(keys, connectionPage(t, full), recorder)(t.Context())
			require.NoError(t, err, "an unsupported projection is not a reason to fail the tick")

			assert.Equal(t, []string{testNamespace + "/a@7"}, identities(t, objs))
			assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "objects"), "the fallback must report objects, or the rollout reads as keys")
			assert.Zero(t, projectionCount(t, reg, connGVR, "keys"))
		})
	}
}

// Any other failure is real and has to surface: swallowing it would hide an
// outage behind a silently more expensive list.
func TestIdentityList_SurfacesOtherErrors(t *testing.T) {
	boom := errors.New("storage unavailable")
	keys := &stubKeysLister{keys: []keysapi.Key{{Namespace: "ns", Name: "a", ResourceVersion: "1"}}, err: boom}

	recorder, reg := newTestRecorder(connGVR)
	objs, _, err := identityList(keys, connectionPage(t, connection("from-full-list")), recorder)(t.Context())
	require.ErrorIs(t, err, boom)
	assert.Zero(t, projectionCount(t, reg, connGVR, "keys"), "a failed tick used no projection")
	assert.Zero(t, projectionCount(t, reg, connGVR, "objects"), "a failed tick used no projection")
	assert.Nil(t, objs, "a failed tick must not deliver a partial set, which the Store would read as deletions")
}

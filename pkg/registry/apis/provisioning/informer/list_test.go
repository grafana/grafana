package informer

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

func jobNames(t *testing.T, objs []runtime.Object) []string {
	t.Helper()
	names := make([]string, 0, len(objs))
	for _, obj := range objs {
		job, ok := obj.(*provisioningapis.Job)
		require.True(t, ok)
		names = append(names, job.Name)
	}
	return names
}

func fivePages() map[string]*provisioningapis.JobList {
	return map[string]*provisioningapis.JobList{
		"":      pagedJobList("page2", "200", "a", "b"),
		"page2": pagedJobList("page3", "200", "c", "d"),
		"page3": pagedJobList("", "200", "e"),
	}
}

func recordingPageFunc(pages map[string]*provisioningapis.JobList, calls *[]string) pageFunc {
	return func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		if calls != nil {
			*calls = append(*calls, opts.Continue)
		}
		l, ok := pages[opts.Continue]
		if !ok {
			return nil, errors.New("unexpected continue token " + opts.Continue)
		}
		return l, nil
	}
}

func TestListPagesBackpressure(t *testing.T) {
	pages := fivePages()

	t.Run("stops after the first page when there is no capacity", func(t *testing.T) {
		var calls []string
		// keepPaging is checked between pages; false stops the chain after page 1.
		out, listRV, next, err := listPages(context.Background(), recordingPageFunc(pages, &calls), "", func(int) bool { return false })
		require.NoError(t, err)
		require.Equal(t, "page2", next, "stopping early reports where to resume")
		require.Equal(t, int64(200), listRV, "the first page still dates the snapshot")
		require.Equal(t, []string{""}, calls, "must not fetch beyond the first page")
		require.Equal(t, []string{"a", "b"}, jobNames(t, out))
	})

	t.Run("keepPaging sees the running fetch count", func(t *testing.T) {
		var calls, seen = []string{}, []int{}
		// Stop once the pass has gathered at least four objects.
		out, _, next, err := listPages(context.Background(), recordingPageFunc(pages, &calls), "", func(fetched int) bool {
			seen = append(seen, fetched)
			return fetched < 4
		})
		require.NoError(t, err)
		require.Equal(t, "page3", next)
		require.Equal(t, []int{2, 4}, seen, "the predicate receives the cumulative count between pages")
		require.Equal(t, []string{"", "page2"}, calls)
		require.Equal(t, []string{"a", "b", "c", "d"}, jobNames(t, out))
	})

	t.Run("reads every page when capacity never runs out", func(t *testing.T) {
		var calls []string
		out, _, next, err := listPages(context.Background(), recordingPageFunc(pages, &calls), "", func(int) bool { return true })
		require.NoError(t, err)
		require.Equal(t, "", next, "reaching the end reports no resume token")
		require.Equal(t, []string{"", "page2", "page3"}, calls)
		require.Equal(t, []string{"a", "b", "c", "d", "e"}, jobNames(t, out))
	})

	t.Run("resumes from a given continue token", func(t *testing.T) {
		var calls []string
		out, _, next, err := listPages(context.Background(), recordingPageFunc(pages, &calls), "page2", func(int) bool { return true })
		require.NoError(t, err)
		require.Equal(t, "", next)
		require.Equal(t, []string{"page2", "page3"}, calls, "starts at the given continue token")
		require.Equal(t, []string{"c", "d", "e"}, jobNames(t, out))
	})

	t.Run("a single-page set reports no resume token regardless of capacity", func(t *testing.T) {
		var calls []string
		page := func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			calls = append(calls, opts.Continue)
			return pagedJobList("", "100", "only"), nil
		}
		// keepPaging returns false, but with no continue token there is no next page
		// to gate — the set fits in one page, so it is read to the end.
		out, _, next, err := listPages(context.Background(), page, "", func(int) bool { return false })
		require.NoError(t, err)
		require.Equal(t, "", next)
		require.Equal(t, []string{""}, calls)
		require.Equal(t, []string{"only"}, jobNames(t, out))
	})
}

// Under sustained backpressure the lister must advance through the pages across
// successive re-lists instead of re-reading page 1 forever — otherwise jobs on
// later pages whose live events were missed are never re-discovered.
func TestResumableListerRotatesUnderBackpressure(t *testing.T) {
	pages := fivePages()
	// Backpressure stops every pass after its first page (keepPaging checked with a
	// non-zero fetch count).
	stop := func(int) bool { return false }
	r := &resumableLister{}

	out, _, complete, err := r.list(context.Background(), recordingPageFunc(pages, nil), stop)
	require.NoError(t, err)
	require.False(t, complete)
	require.Equal(t, []string{"a", "b"}, jobNames(t, out), "pass 1 reads page 1")

	out, _, complete, err = r.list(context.Background(), recordingPageFunc(pages, nil), stop)
	require.NoError(t, err)
	require.False(t, complete)
	require.Equal(t, []string{"c", "d"}, jobNames(t, out), "pass 2 advances past the pages already covered")

	out, _, complete, err = r.list(context.Background(), recordingPageFunc(pages, nil), stop)
	require.NoError(t, err)
	require.False(t, complete, "a resumed sweep that reaches the end is still partial — it never saw the earlier pages")
	require.Equal(t, []string{"e"}, jobNames(t, out), "pass 3 reads the last page")

	out, _, _, err = r.list(context.Background(), recordingPageFunc(pages, nil), stop)
	require.NoError(t, err)
	require.Equal(t, []string{"a", "b"}, jobNames(t, out), "after the end it wraps to a fresh sweep from page 1")
}

// Only a sweep that starts at page 1 and reaches the end is complete — the one
// case the informer may delete-diff.
func TestResumableListerCompleteOnFullSweep(t *testing.T) {
	r := &resumableLister{}
	out, _, complete, err := r.list(context.Background(), recordingPageFunc(fivePages(), nil), func(int) bool { return true })
	require.NoError(t, err)
	require.True(t, complete, "a sweep from page 1 to the end is complete")
	require.Equal(t, []string{"a", "b", "c", "d", "e"}, jobNames(t, out))
}

// A resume token whose snapshot was compacted between re-lists must not fail the
// re-list; the sweep restarts from page 1.
func TestResumableListerRestartsOnExpiredResumeToken(t *testing.T) {
	pages := map[string]*provisioningapis.JobList{
		"":      pagedJobList("page2", "200", "a", "b"),
		"page2": pagedJobList("", "200", "c"),
	}
	expirePage2 := false
	page := func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		if opts.Continue == "page2" && expirePage2 {
			return nil, apierrors.NewResourceExpired("continue token expired")
		}
		return recordingPageFunc(pages, nil)(context.Background(), opts)
	}
	stop := func(int) bool { return false }
	r := &resumableLister{}

	_, _, _, err := r.list(context.Background(), page, stop)
	require.NoError(t, err) // pass 1 reads page 1, resumes at page2

	// The snapshot page2 pointed at is compacted before the next pass.
	expirePage2 = true
	out, _, complete, err := r.list(context.Background(), page, stop)
	require.NoError(t, err, "an expired resume token must not fail the re-list")
	require.False(t, complete)
	require.Equal(t, []string{"a", "b"}, jobNames(t, out), "it restarts the sweep from page 1")
}

package informer

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
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

func TestListPagesBackpressure(t *testing.T) {
	pages := map[string]*provisioningapis.JobList{
		"":      pagedJobList("page2", "200", "a", "b"),
		"page2": pagedJobList("page3", "200", "c", "d"),
		"page3": pagedJobList("", "200", "e"),
	}
	newPageFunc := func(calls *[]string) pageFunc {
		return func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			*calls = append(*calls, opts.Continue)
			l, ok := pages[opts.Continue]
			require.Truef(t, ok, "unexpected continue token %q", opts.Continue)
			return l, nil
		}
	}

	t.Run("stops after the first page when there is no capacity", func(t *testing.T) {
		var calls []string
		// keepPaging is checked between pages; false stops the chain after page 1.
		out, listRV, complete, err := listPages(context.Background(), newPageFunc(&calls), func() bool { return false })
		require.NoError(t, err)
		require.False(t, complete, "a chain stopped early must report incomplete")
		require.Equal(t, int64(200), listRV, "the first page still dates the snapshot")
		require.Equal(t, []string{""}, calls, "must not fetch beyond the first page")
		require.Equal(t, []string{"a", "b"}, jobNames(t, out))
	})

	t.Run("reads exactly the pages capacity allows", func(t *testing.T) {
		var calls []string
		// Capacity for two pages, then backpressure stops the third.
		budget := 2
		out, _, complete, err := listPages(context.Background(), newPageFunc(&calls), func() bool {
			budget--
			return budget > 0
		})
		require.NoError(t, err)
		require.False(t, complete)
		require.Equal(t, []string{"", "page2"}, calls)
		require.Equal(t, []string{"a", "b", "c", "d"}, jobNames(t, out))
	})

	t.Run("reads every page when capacity never runs out", func(t *testing.T) {
		var calls []string
		out, _, complete, err := listPages(context.Background(), newPageFunc(&calls), func() bool { return true })
		require.NoError(t, err)
		require.True(t, complete, "reaching the end reports complete")
		require.Equal(t, []string{"", "page2", "page3"}, calls)
		require.Equal(t, []string{"a", "b", "c", "d", "e"}, jobNames(t, out))
	})

	t.Run("a single-page set is always complete regardless of capacity", func(t *testing.T) {
		var calls []string
		page := func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
			calls = append(calls, opts.Continue)
			return pagedJobList("", "100", "only"), nil
		}
		// keepPaging returns false, but with no continue token there is no next page
		// to gate — the set fits in one page, so it is complete.
		out, _, complete, err := listPages(context.Background(), page, func() bool { return false })
		require.NoError(t, err)
		require.True(t, complete)
		require.Equal(t, []string{""}, calls)
		require.Equal(t, []string{"only"}, jobNames(t, out))
	})
}

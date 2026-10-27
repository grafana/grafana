package informer

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// pagedList builds one page of a paginated LIST: the named objects plus the
// continue token pointing at the next page (empty on the last page) and the
// snapshot resource version (pinned across pages by the continue token).
func pagedList(continueToken, resourceVersion string, names ...string) *metav1.PartialObjectMetadataList {
	l := &metav1.PartialObjectMetadataList{
		ListMeta: metav1.ListMeta{Continue: continueToken, ResourceVersion: resourceVersion},
	}
	for _, name := range names {
		l.Items = append(l.Items, metav1.PartialObjectMetadata{
			ObjectMeta: metav1.ObjectMeta{Namespace: "default", Name: name},
		})
	}
	return l
}

func TestListAllPages(t *testing.T) {
	tests := []struct {
		name string
		// pages is keyed by the continue token the page func receives; "" is the
		// first call.
		pages      map[string]*metav1.PartialObjectMetadataList
		errOn      string // continue token whose page fails
		wantNames  []string
		wantListRV string // resource version ListAllPages reports for the snapshot
		wantErr    bool
		wantCalls  []string // continue tokens received, in order
	}{
		{
			name: "single page",
			pages: map[string]*metav1.PartialObjectMetadataList{
				"": pagedList("", "100", "a", "b"),
			},
			wantNames:  []string{"a", "b"},
			wantListRV: "100",
			wantCalls:  []string{""},
		},
		{
			name: "follows continue tokens across pages",
			pages: map[string]*metav1.PartialObjectMetadataList{
				"":      pagedList("page2", "200", "a", "b"),
				"page2": pagedList("page3", "200", "c", "d"),
				"page3": pagedList("", "200", "e"),
			},
			wantNames:  []string{"a", "b", "c", "d", "e"},
			wantListRV: "200", // pinned to the first page's version across pages
			wantCalls:  []string{"", "page2", "page3"},
		},
		{
			name: "error on a later page fails the whole list",
			pages: map[string]*metav1.PartialObjectMetadataList{
				"": pagedList("page2", "300", "a", "b"),
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

			out, listRV, err := ListAllPages(context.Background(), page)
			require.Equal(t, tt.wantCalls, calls)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantListRV, listRV)
			names := make([]string, 0, len(out))
			for _, obj := range out {
				item, ok := obj.(*metav1.PartialObjectMetadata)
				require.True(t, ok)
				names = append(names, item.Name)
			}
			require.Equal(t, tt.wantNames, names)
		})
	}
}

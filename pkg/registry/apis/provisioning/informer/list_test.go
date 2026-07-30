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
// continue token pointing at the next page (empty on the last page).
func pagedJobList(continueToken string, names ...string) *provisioningapis.JobList {
	l := &provisioningapis.JobList{
		ListMeta: metav1.ListMeta{Continue: continueToken},
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
		pages     map[string]*provisioningapis.JobList
		errOn     string // continue token whose page fails
		wantNames []string
		wantErr   bool
		wantCalls []string // continue tokens received, in order
	}{
		{
			name: "single page",
			pages: map[string]*provisioningapis.JobList{
				"": pagedJobList("", "a", "b"),
			},
			wantNames: []string{"a", "b"},
			wantCalls: []string{""},
		},
		{
			name: "follows continue tokens across pages",
			pages: map[string]*provisioningapis.JobList{
				"":      pagedJobList("page2", "a", "b"),
				"page2": pagedJobList("page3", "c", "d"),
				"page3": pagedJobList("", "e"),
			},
			wantNames: []string{"a", "b", "c", "d", "e"},
			wantCalls: []string{"", "page2", "page3"},
		},
		{
			name: "error on a later page fails the whole list",
			pages: map[string]*provisioningapis.JobList{
				"": pagedJobList("page2", "a", "b"),
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

			out, err := listAllPages(context.Background(), page)
			require.Equal(t, tt.wantCalls, calls)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
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

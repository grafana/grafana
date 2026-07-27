package informer

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// pagedJobs serves total jobs as pages of listPageSize, recording the options of
// every request so a test can assert the LIST was actually bounded.
type pagedJobs struct {
	total    int
	requests []metav1.ListOptions
}

func (p *pagedJobs) list(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
	p.requests = append(p.requests, opts)

	start := 0
	if opts.Continue != "" {
		if _, err := fmt.Sscanf(opts.Continue, "from-%d", &start); err != nil {
			return nil, err
		}
	}
	end := min(start+int(opts.Limit), p.total)

	l := &provisioningapis.JobList{}
	for i := start; i < end; i++ {
		l.Items = append(l.Items, provisioningapis.Job{
			ObjectMeta: metav1.ObjectMeta{Namespace: testNamespace, Name: fmt.Sprintf("job-%d", i)},
		})
	}
	if end < p.total {
		l.Continue = fmt.Sprintf("from-%d", end)
	}
	return l, nil
}

func TestPagedList_WalksEveryPage(t *testing.T) {
	src := &pagedJobs{total: listPageSize*2 + 7}

	objs, err := pagedList(context.Background(), src.list)
	require.NoError(t, err)
	require.Len(t, objs, src.total)

	// Every request is bounded, and each after the first resumes from the
	// previous page's continue token.
	require.Len(t, src.requests, 3)
	for i, req := range src.requests {
		assert.Equal(t, int64(listPageSize), req.Limit, "request %d", i)
	}
	assert.Empty(t, src.requests[0].Continue)
	assert.Equal(t, fmt.Sprintf("from-%d", listPageSize), src.requests[1].Continue)
	assert.Equal(t, fmt.Sprintf("from-%d", listPageSize*2), src.requests[2].Continue)

	// Items are distinct objects, not repeated pointers into a reused page.
	names := make([]string, 0, len(objs))
	for _, obj := range objs {
		job, ok := obj.(*provisioningapis.Job)
		require.True(t, ok)
		names = append(names, job.Name)
	}
	assert.Equal(t, "job-0", names[0])
	assert.Equal(t, fmt.Sprintf("job-%d", src.total-1), names[len(names)-1])
	assert.Len(t, uniqueNames(names), src.total)
}

func TestEachListItem_HoldsOnlyOnePage(t *testing.T) {
	src := &pagedJobs{total: listPageSize + 1}

	seen := 0
	require.NoError(t, eachListItem(context.Background(), src.list, func(runtime.Object) error {
		seen++
		return nil
	}))

	assert.Equal(t, src.total, seen)
	assert.Len(t, src.requests, 2)
}

func TestEachListItem_PropagatesListError(t *testing.T) {
	wantErr := fmt.Errorf("boom")
	list := func(context.Context, metav1.ListOptions) (runtime.Object, error) { return nil, wantErr }

	err := eachListItem(context.Background(), list, func(runtime.Object) error { return nil })
	assert.ErrorIs(t, err, wantErr)
}

func uniqueNames(names []string) map[string]struct{} {
	out := make(map[string]struct{}, len(names))
	for _, n := range names {
		out[n] = struct{}{}
	}
	return out
}

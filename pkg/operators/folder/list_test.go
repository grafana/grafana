package folder

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// The metadata client returns PartialObjectMetadataList instead of
// UnstructuredList, so make sure the pager still walks it correctly.
func TestListAllPages_PartialObjectMetadata(t *testing.T) {
	pages := []*metav1.PartialObjectMetadataList{
		{
			ListMeta: metav1.ListMeta{ResourceVersion: "100", Continue: "page-2"},
			Items: []metav1.PartialObjectMetadata{
				{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "a"}},
				{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "b"}},
			},
		},
		{
			ListMeta: metav1.ListMeta{ResourceVersion: "100"},
			Items: []metav1.PartialObjectMetadata{
				{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "c"}},
			},
		},
	}

	var calls int
	page := func(_ context.Context, opts metav1.ListOptions) (runtime.Object, error) {
		require.Less(t, calls, len(pages), "unexpected extra page call")
		p := pages[calls]
		if calls == 0 {
			require.Empty(t, opts.Continue, "first call must not carry a continue token")
		} else {
			require.Equal(t, pages[calls-1].Continue, opts.Continue)
		}
		calls++
		return p, nil
	}

	objs, listRV, err := listAllPages(context.Background(), page)
	require.NoError(t, err)
	require.Equal(t, 2, calls)
	require.EqualValues(t, 100, listRV)

	var names []string
	for _, obj := range objs {
		accessor, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		names = append(names, accessor.GetName())
	}
	require.Equal(t, []string{"a", "b", "c"}, names)
}

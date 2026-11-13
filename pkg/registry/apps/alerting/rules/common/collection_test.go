package common

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// pagedList returns one name per page, with a continue token pointing at the next page.
func pagedList(names []string, seen *[]internalversion.ListOptions) func(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
	return func(_ context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
		*seen = append(*seen, *opts.DeepCopy())
		page := 0
		if opts.Continue != "" {
			for i, n := range names {
				if n == opts.Continue {
					page = i
				}
			}
		}
		list := &v1beta1.AlertRuleList{Items: []v1beta1.AlertRule{{ObjectMeta: metav1.ObjectMeta{Name: names[page]}}}}
		if page+1 < len(names) {
			list.Continue = names[page+1]
		}
		return list, nil
	}
}

func itemNames(t *testing.T, items []runtime.Object) []string {
	t.Helper()
	out := make([]string, 0, len(items))
	for _, item := range items {
		out = append(out, item.(*v1beta1.AlertRule).Name)
	}
	return out
}

func TestListForDeleteCollection(t *testing.T) {
	t.Run("follows continue tokens until the list is exhausted when no limit is set", func(t *testing.T) {
		var seen []internalversion.ListOptions
		opts := &internalversion.ListOptions{ResourceVersion: "5", ResourceVersionMatch: metav1.ResourceVersionMatchExact}

		items, next, err := ListForDeleteCollection(context.Background(), pagedList([]string{"a", "b", "c"}, &seen), opts)

		require.NoError(t, err)
		require.Equal(t, []string{"a", "b", "c"}, itemNames(t, items))
		require.Empty(t, next)
		require.Len(t, seen, 3)
		require.Equal(t, "5", seen[0].ResourceVersion, "the first page honors the caller's resource version")
		require.Empty(t, seen[1].ResourceVersion, "later pages must not pin a resource version")
		require.Empty(t, seen[1].ResourceVersionMatch)
		require.Equal(t, "5", opts.ResourceVersion, "the caller's options must not be mutated")
		require.Empty(t, opts.Continue)
	})

	t.Run("returns only one page and its continue token when a limit is set", func(t *testing.T) {
		var seen []internalversion.ListOptions

		items, next, err := ListForDeleteCollection(context.Background(), pagedList([]string{"a", "b", "c"}, &seen), &internalversion.ListOptions{Limit: 1})

		require.NoError(t, err)
		require.Equal(t, []string{"a"}, itemNames(t, items))
		require.Equal(t, "b", next)
		require.Len(t, seen, 1)
	})

	t.Run("propagates list errors", func(t *testing.T) {
		boom := errors.New("boom")

		_, _, err := ListForDeleteCollection(context.Background(), func(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
			return nil, boom
		}, &internalversion.ListOptions{})

		require.ErrorIs(t, err, boom)
	})

	t.Run("stops when the context is cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		var seen []internalversion.ListOptions

		_, _, err := ListForDeleteCollection(ctx, pagedList([]string{"a"}, &seen), &internalversion.ListOptions{})

		require.ErrorIs(t, err, context.Canceled)
		require.Empty(t, seen)
	})
}

func TestValidateDeleteCollectionRequest(t *testing.T) {
	selector := func(t *testing.T, s string) labels.Selector {
		t.Helper()
		sel, err := labels.Parse(s)
		require.NoError(t, err)
		return sel
	}

	t.Run("accepts a plain request and ordinary selectors", func(t *testing.T) {
		require.NoError(t, ValidateDeleteCollectionRequest(&metav1.DeleteOptions{}, &internalversion.ListOptions{}))
		require.NoError(t, ValidateDeleteCollectionRequest(nil, &internalversion.ListOptions{LabelSelector: selector(t, "a=b")}))
	})

	t.Run("rejects dry-run", func(t *testing.T) {
		err := ValidateDeleteCollectionRequest(&metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}}, &internalversion.ListOptions{})
		require.True(t, k8serrors.IsBadRequest(err), "got %v", err)
	})

	t.Run("rejects history and trash selectors", func(t *testing.T) {
		for _, key := range []string{utils.LabelKeyGetHistory, utils.LabelKeyGetTrash} {
			err := ValidateDeleteCollectionRequest(&metav1.DeleteOptions{}, &internalversion.ListOptions{LabelSelector: selector(t, key+"=true")})
			require.True(t, k8serrors.IsBadRequest(err), "%s: got %v", key, err)
		}
	})

	t.Run("rejects malformed special selectors", func(t *testing.T) {
		err := ValidateDeleteCollectionRequest(&metav1.DeleteOptions{}, &internalversion.ListOptions{LabelSelector: selector(t, utils.LabelKeyGetHistory+"=false")})
		require.True(t, k8serrors.IsBadRequest(err), "got %v", err)
	})
}

package dualwrite_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type readModeFunc func(context.Context, schema.GroupResource) (bool, error)

func (f readModeFunc) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	return f(ctx, gr)
}

type titleLookup interface {
	Title(name string) string
}

type legacyTitles map[string]string

func (l legacyTitles) Title(name string) string {
	return l[name]
}

type unifiedTitles struct {
	titles map[string]string
}

func (u *unifiedTitles) Title(name string) string {
	return u.titles[name]
}

func TestSelectorResolve(t *testing.T) {
	ctx := t.Context()
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "items"}
	legacy := legacyTitles{"item": "legacy title"}
	unified := &unifiedTitles{titles: map[string]string{"item": "unified title"}}

	var readUnified bool
	var calls int
	var gotCtx context.Context
	var gotGR schema.GroupResource
	reader := readModeFunc(func(ctx context.Context, gr schema.GroupResource) (bool, error) {
		gotCtx, gotGR = ctx, gr
		calls++
		return readUnified, nil
	})
	selector := dualwrite.NewSelector[titleLookup](reader, gr, legacy, unified)
	require.Zero(t, calls, "construction must not resolve the mode")

	for _, tt := range []struct {
		name    string
		unified bool
		want    titleLookup
	}{
		{name: "legacy", want: legacy},
		{name: "switch to unified", unified: true, want: unified},
		{name: "switch back to legacy", want: legacy},
	} {
		t.Run(tt.name, func(t *testing.T) {
			readUnified = tt.unified
			before := calls

			backend, err := selector.Resolve(ctx)

			require.NoError(t, err)
			require.Equal(t, ctx, gotCtx)
			require.Equal(t, gr, gotGR)
			require.Equal(t, tt.want, backend)
			require.Equal(t, tt.want.Title("item"), backend.Title("item"))
			require.Equal(t, before+1, calls, "each operation must resolve the mode once")
		})
	}
}

func TestSelectorResolveError(t *testing.T) {
	gr := schema.GroupResource{Group: "test.grafana.app", Resource: "items"}
	wantErr := errors.New("mode unavailable")

	for _, unified := range []bool{false, true} {
		reader := readModeFunc(func(context.Context, schema.GroupResource) (bool, error) {
			return unified, wantErr
		})
		selector := dualwrite.NewSelector[titleLookup](reader, gr, legacyTitles{}, &unifiedTitles{})

		backend, err := selector.Resolve(t.Context())

		require.ErrorIs(t, err, wantErr)
		require.Nil(t, backend, "mode errors must not select either backend")
	}
}

func TestSelectorResolveCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	reader := readModeFunc(func(ctx context.Context, _ schema.GroupResource) (bool, error) {
		return false, ctx.Err()
	})
	selector := dualwrite.NewSelector(reader, schema.GroupResource{}, "legacy", "unified")

	backend, err := selector.Resolve(ctx)

	require.ErrorIs(t, err, context.Canceled)
	require.Empty(t, backend)
}

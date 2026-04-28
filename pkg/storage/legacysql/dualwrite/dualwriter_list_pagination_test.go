package dualwrite

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

// TestDualWriter_List_LegacyDonePaging covers the early-return when the combined
// continue token encodes an empty legacy cursor (legacy finished paging) but unified
// still has more. The writer should return an empty list without touching either store.
func TestDualWriter_List_LegacyDonePaging(t *testing.T) {
	ls := &fakeStorage{}
	us := &fakeStorage{}

	dw, err := newStorage(kind, rest.Mode1, ls, us)
	require.NoError(t, err)

	// legacyToken="" signals that legacy has been fully consumed.
	continueToken := buildContinueToken("", "some-unified-cursor")

	obj, err := dw.List(context.Background(), &metainternalversion.ListOptions{Continue: continueToken})
	require.NoError(t, err)
	require.Nil(t, obj) // fakeStorage.NewList() returns nil

	// Neither store should have been called
	require.Empty(t, ls.listCalls)
	require.Empty(t, us.listCalls)
}

// TestDualWriter_List_UnifiedDonePaging covers the case where the combined token
// encodes an empty unified cursor (unified finished paging) but legacy still has
// more. The writer should skip the unified request entirely.
func TestDualWriter_List_UnifiedDonePaging(t *testing.T) {
	ls := &fakeStorage{}
	us := &fakeStorage{}

	ls.onList(exampleList, nil)

	dw, err := newStorage(kind, rest.Mode1, ls, us)
	require.NoError(t, err)

	// unifiedToken="" signals that unified has been fully consumed.
	continueToken := buildContinueToken("legacy-cursor", "")

	obj, err := dw.List(context.Background(), &metainternalversion.ListOptions{Continue: continueToken})
	require.NoError(t, err)
	require.Equal(t, exampleList, obj)

	require.NotEmpty(t, ls.listCalls)
	require.Empty(t, us.listCalls)
}

// TestDualWriter_List_UnifiedTimeoutDoesNotBlock verifies that when the unified
// list call takes longer than the 300 ms budget the writer returns the legacy
// result immediately without blocking.
func TestDualWriter_List_UnifiedTimeoutDoesNotBlock(t *testing.T) {
	ls := &fakeStorage{}
	us := &fakeStorage{}

	ls.onList(exampleList, nil)
	// unified deliberately blocks until ctx is canceled (simulates slow response)
	us.blockList = true

	dw, err := newStorage(kind, rest.Mode1, ls, us)
	require.NoError(t, err)

	start := time.Now()
	obj, err := dw.List(context.Background(), &metainternalversion.ListOptions{})
	elapsed := time.Since(start)

	require.NoError(t, err)
	require.Equal(t, exampleList, obj) // legacy result, not unified
	require.Less(t, elapsed, 500*time.Millisecond, "List should not block waiting for unified")
}

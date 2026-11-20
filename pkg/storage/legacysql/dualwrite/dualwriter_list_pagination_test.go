package dualwrite

import (
	"context"
	"testing"
	"testing/synctest"
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

func TestDualWriter_List_UnifiedTimeoutDoesNotBlock(t *testing.T) {
	// Use fake time so CI scheduling delays cannot fail the timeout assertion.
	synctest.Test(t, func(t *testing.T) {
		ls := &fakeStorage{}
		us := &fakeStorage{blockList: true}
		ls.onList(exampleList, nil)

		dw, err := newStorage(kind, rest.Mode1, ls, us)
		require.NoError(t, err)

		// Let the background request reach its deadline before leaving the bubble.
		defer time.Sleep(backgroundReqTimeout)

		start := time.Now()
		obj, err := dw.List(t.Context(), &metainternalversion.ListOptions{})
		elapsed := time.Since(start)

		require.NoError(t, err)
		require.Equal(t, exampleList, obj)
		require.Equal(t, 300*time.Millisecond, elapsed, "List should return before the unified request finishes")
	})
}

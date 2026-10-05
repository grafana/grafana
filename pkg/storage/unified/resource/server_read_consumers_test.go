package resource

import (
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestWatchPreviousReadError(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		events, stream, done := startBookmarkWatch(t, bookmarkWatchRequest(), func(srv *server, _ *bookmarkWatchServer) {
			srv.backend = &internalReadBackend{failure: &resourcepb.ErrorResult{
				Code: http.StatusInternalServerError, Message: "previous version read failed",
			}}
		})
		event := bookmarkWrittenEvent(200)
		event.Type = resourcepb.WatchEvent_MODIFIED
		event.PreviousRV = 150
		events <- event
		synctest.Wait()

		require.Empty(t, done, "watch should remain open after the previous version read fails")
		require.Len(t, stream.events, 1)
		got := <-stream.events
		require.Equal(t, event.Type, got.Type)
		require.Equal(t, event.ResourceVersion, got.Resource.Version)
		require.Equal(t, event.Value, got.Resource.Value)
		require.Nil(t, got.Previous)
	})
}

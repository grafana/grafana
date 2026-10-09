package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
)

func TestSearchServerStopBeforeInit(t *testing.T) {
	backend := &mockSearchBackend{}
	server, err := NewUninitializedSearchServer(Options{
		Backend: &mockStorageBackend{},
		Search: searchmodel.SearchOptions{
			Backend:   backend,
			Resources: &searchmodel.TestDocumentBuilderSupplier{GroupsResources: map[string]string{"group": "resources"}},
		},
	})
	require.NoError(t, err)
	require.NoError(t, server.Stop(t.Context()))
	require.EqualValues(t, 1, backend.stopCalls.Load())
}

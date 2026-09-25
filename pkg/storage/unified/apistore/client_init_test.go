package apistore

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	clientrest "k8s.io/client-go/rest"
)

type retryConfigProvider struct {
	calls int
}

func (p *retryConfigProvider) GetRestConfig(context.Context) (*clientrest.Config, error) {
	p.calls++
	if p.calls == 1 {
		return nil, context.DeadlineExceeded
	}
	return &clientrest.Config{Host: "http://folders"}, nil
}

func TestFolderClientInitializationRetriesFailure(t *testing.T) {
	provider := &retryConfigProvider{}
	store, destroy, err := NewStorage(&storagebackend.ConfigForResource{}, nil, nil, nil, nil, nil, nil, nil, nil, provider, StorageOptions{EnableFolderSupport: true})
	require.NoError(t, err)
	t.Cleanup(destroy)
	s := store.(*Storage)
	_, err = s.getDynClient(t.Context())
	require.ErrorIs(t, err, context.DeadlineExceeded)
	client, err := s.getDynClient(t.Context())
	require.NoError(t, err)
	require.NotNil(t, client)
	var wg sync.WaitGroup
	for range 10 {
		wg.Go(func() {
			cached, err := s.getDynClient(t.Context())
			assert.NoError(t, err)
			assert.Same(t, client, cached)
		})
	}
	wg.Wait()
	require.Equal(t, 2, provider.calls)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = s.getDynClient(ctx)
	require.ErrorIs(t, err, context.Canceled)
}

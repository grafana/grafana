package promclient_test

import (
	"context"
	"errors"
	"sort"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/promclient"

	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/stretchr/testify/require"
)

func TestCache_GetClient(t *testing.T) {
	t.Run("it caches the client for a set of auth headers", func(t *testing.T) {
		tc := setupCacheContext()

		c, err := tc.providerCache.GetClient(headers)
		require.Nil(t, err)

		c2, err := tc.providerCache.GetClient(headers)
		require.Nil(t, err)

		require.Equal(t, c, c2)
		require.Equal(t, 1, tc.clientProvider.numCalls)
	})

	t.Run("it returns different clients when the headers differ", func(t *testing.T) {
		tc := setupCacheContext()
		h1 := map[string]string{"Authorization": "token", "X-ID-Token": "id-token"}
		h2 := map[string]string{"Authorization": "token2", "X-ID-Token": "id-token"}

		c, err := tc.providerCache.GetClient(h1)
		require.Nil(t, err)

		c2, err := tc.providerCache.GetClient(h2)
		require.Nil(t, err)

		require.NotEqual(t, c, c2)
		require.Equal(t, 2, tc.clientProvider.numCalls)
	})

	t.Run("it returns from the cache when headers are the same", func(t *testing.T) {
		tc := setupCacheContext()
		h1 := map[string]string{"Authorization": "token", "X-ID-Token": "id-token"}
		h2 := map[string]string{"Authorization": "token", "X-ID-Token": "id-token"}

		c, err := tc.providerCache.GetClient(h1)
		require.Nil(t, err)

		c2, err := tc.providerCache.GetClient(h2)
		require.Nil(t, err)

		require.Equal(t, c, c2)
		require.Equal(t, 1, tc.clientProvider.numCalls)
	})

	t.Run("it doesn't cache anything when an error occurs", func(t *testing.T) {
		tc := setupCacheContext()
		tc.clientProvider.errors <- errors.New("something bad")

		_, err := tc.providerCache.GetClient(headers)
		require.EqualError(t, err, "something bad")

		c, err := tc.providerCache.GetClient(headers)
		require.Nil(t, err)

		require.NotNil(t, c)
		require.Equal(t, 2, tc.clientProvider.numCalls)
	})
}

type cacheTestContext struct {
	providerCache  *promclient.ProviderCache
	clientProvider *fakePromClientProvider
}

func setupCacheContext() *cacheTestContext {
	fp := newFakePromClientProvider()
	p, err := promclient.NewProviderCache(fp)
	if err != nil {
		panic(err)
	}

	return &cacheTestContext{
		providerCache:  p,
		clientProvider: fp,
	}
}

func newFakePromClientProvider() *fakePromClientProvider {
	return &fakePromClientProvider{
		errors: make(chan error, 1),
	}
}

type fakePromClientProvider struct {
	headers  map[string]string
	numCalls int
	errors   chan error
}

func (p *fakePromClientProvider) GetClient(h map[string]string) (apiv1.API, error) {
	p.headers = h
	p.numCalls++

	var err error
	select {
	case err = <-p.errors:
	default:
	}

	var config []string
	for _, v := range h {
		config = append(config, v)
	}
	sort.Strings(config) //because map
	return &fakePromClient{config: strings.Join(config, "")}, err
}

type fakePromClient struct {
	apiv1.API
	config string
}

func (c *fakePromClient) Config(ctx context.Context) (apiv1.ConfigResult, error) {
	return apiv1.ConfigResult{YAML: c.config}, nil
}

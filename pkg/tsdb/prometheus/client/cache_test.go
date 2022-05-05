package client_test

import (
	"errors"
	"io/ioutil"
	"net/http"
	"sort"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/client"

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
	providerCache  *client.ProviderCache
	clientProvider *fakeClientProvider
}

func setupCacheContext() *cacheTestContext {
	fp := newFakePromClientProvider()
	p, err := client.NewProviderCache(fp)
	if err != nil {
		panic(err)
	}

	return &cacheTestContext{
		providerCache:  p,
		clientProvider: fp,
	}
}

func newFakePromClientProvider() *fakeClientProvider {
	return &fakeClientProvider{
		errors: make(chan error, 1),
	}
}

type fakeClientProvider struct {
	headers  map[string]string
	numCalls int
	errors   chan error
}

func (p *fakeClientProvider) GetClient(h map[string]string) (*client.Client, error) {
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
	res := &http.Response{
		StatusCode: 200,
		Header:     http.Header{},
		Body:       ioutil.NopCloser(strings.NewReader(strings.Join(config, ","))),
	}
	c := &fakeClient{res: res}
	return client.NewClient(c, "GET", "http://localhost:9090/"), err
}

type fakeClient struct {
	res *http.Response
}

func (c *fakeClient) Do(req *http.Request) (*http.Response, error) {
	return c.res, nil
}

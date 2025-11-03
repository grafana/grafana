package testing

import (
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/open-feature/go-sdk/openfeature/testing"
	"golang.org/x/net/context"
	"sync"
)

var (
	mutex    sync.Mutex
	provider *testing.TestProvider
)

type TestClient struct {
	delegate *openfeature.Client
	test     *testing.TestProvider
}

func NewTestClient() *TestClient {
	mutex.Lock()
	defer mutex.Unlock()

	err := openfeature.SetProviderAndWait(provider)
	if err != nil {
		panic("unable to set test provider: " + err.Error())
	}
	return &TestClient{
		delegate: openfeature.NewDefaultClient(),
		test:     provider,
	}
}

func (c *TestClient) IsEnabled(ctx context.Context, flag string) bool {
	return c.delegate.Boolean(ctx, flag, false, openfeature.TransactionContext(ctx))
}

func (c *TestClient) SetFeatureFlags(t testing.TestFramework, flags map[string]memprovider.InMemoryFlag) {
	provider.UsingFlags(t, flags)
}

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

type FeatureFlag struct {
	Name  string
	Value bool
}

func NewFeatureFlag(name string, value bool) *FeatureFlag {
	return &FeatureFlag{
		Name:  name,
		Value: value,
	}
}

type TestClient struct {
	delegate *openfeature.Client
	test     *testing.TestProvider
}

func NewTestClient() *TestClient {
	mutex.Lock()
	defer mutex.Unlock()

	provider2 := testing.NewTestProvider()
	if provider == nil {
		provider = &provider2
	}

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

func (c *TestClient) SetFeatureFlags(t testing.TestFramework, flags ...FeatureFlag) {
	featureFlags := make(map[string]memprovider.InMemoryFlag)

	for _, flag := range flags {

		defaultVariant := "off"
		if flag.Value {
			defaultVariant = "on"
		}

		variants := map[string]any{
			"on":  true,
			"off": false,
		}

		featureFlags[flag.Name] = memprovider.InMemoryFlag{
			Key:            flag.Name,
			State:          memprovider.Enabled,
			DefaultVariant: defaultVariant,
			Variants:       variants,
		}
	}
	provider.UsingFlags(t, featureFlags)
}

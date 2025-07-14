package featuremgmt

import (
	"net/http"

	gofeatureflag "github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg"
	"github.com/open-feature/go-sdk/openfeature"
)

func newGOFFProvider(url string, client *http.Client) (openfeature.FeatureProvider, error) {
	options := gofeatureflag.ProviderOptions{
		Endpoint: url,
		HTTPClient: client,
	}
	provider, err := gofeatureflag.NewProvider(options)
	return provider, err
}

package featuremgmt

import (
	"net/http"
	"time"

	gofeatureflag "github.com/open-feature/go-sdk-contrib/providers/go-feature-flag/pkg"
	"github.com/open-feature/go-sdk/openfeature"
)

func newGOFFProvider(url string) (openfeature.FeatureProvider, error) {
	options := gofeatureflag.ProviderOptions{
		Endpoint: url,
		// consider using github.com/grafana/grafana/pkg/infra/httpclient/provider.go
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
	provider, err := gofeatureflag.NewProvider(options)
	return provider, err
}

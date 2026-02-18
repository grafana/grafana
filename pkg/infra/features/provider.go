package features

import (
	"fmt"
	"net/http"

	ofrep "github.com/open-feature/go-sdk-contrib/providers/ofrep"
	"github.com/open-feature/go-sdk/openfeature"
)

// NewOFREPProvider creates an OFREP-compatible provider
func NewOFREPProvider(url string, client *http.Client) (openfeature.FeatureProvider, error) {
	if url == "" {
		return nil, fmt.Errorf("URL is required for OFREP provider")
	}

	options := []ofrep.Option{}
	if client != nil {
		options = append(options, ofrep.WithClient(client))
	}

	return ofrep.NewProvider(url, options...), nil
}

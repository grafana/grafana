package featuremgmt

import (
	"net/http"

	ofrep "github.com/open-feature/go-sdk-contrib/providers/ofrep"
	"github.com/open-feature/go-sdk/openfeature"
)

func newOFREPProvider(url string, client *http.Client) (openfeature.FeatureProvider, error) {
	options := []ofrep.Option{}
	if client != nil {
		options = append(options, ofrep.WithClient(client))
	}

	return ofrep.NewProvider(url, options...), nil
}

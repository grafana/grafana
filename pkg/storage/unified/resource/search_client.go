package resource

import "github.com/grafana/grafana/pkg/apiserver/rest"

func NewSearchClient(mode rest.DualWriterMode, unifiedClient ResourceIndexClient, legacyClient ResourceIndexClient) ResourceIndexClient {
	switch mode {
	case rest.Mode0, rest.Mode1, rest.Mode2:
		return legacyClient
	default:
		return unifiedClient
	}
}

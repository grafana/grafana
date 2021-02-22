package backendplugin

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// CallResourceClientResponseStream is used for receiving resource call responses.
type CallResourceClientResponseStream interface {
	Recv() (*backend.CallResourceResponse, error)
	Close() error
}

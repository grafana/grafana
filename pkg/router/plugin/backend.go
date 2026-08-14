package plugin

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/router"
)

// pluginBackend serves a plugin under the selected route
type pluginBackend struct {
	rv    string
	group string

	client   plugins.Client
	jsonData plugins.JSONData
	manifest *app.ManifestData
}

var _ router.Backend = &pluginBackend{}

// NewPluginBackend will be called on startup and when any plugins change
// This will not initialize any long running state
func NewPluginBackend(bundle plugins.FoundBundle, client plugins.Client) (router.Backend, error) {
	// TODO, find manifest etc
	return &pluginBackend{
		rv:       bundle.Primary.JSONData.Info.Updated,
		group:    bundle.Primary.JSONData.ID,
		client:   client,
		jsonData: bundle.Primary.JSONData,
	}, nil
}

func (b *pluginBackend) Manifest() *app.ManifestData {
	return b.manifest
}

func (b *pluginBackend) Group() string {
	return b.group
}

func (b *pluginBackend) RV() string {
	return b.rv
}

// Load is called on startup and after the RV changes.  This is where any complicated initialization should happen
func (b *pluginBackend) Load(ctx context.Context) (http.Handler, error) {
	// TODO: this will create the apiserver that handles resources and delegates to the plugin when necessary
	// for now it is creates a dummy handler so we can see that our setup is working
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_, _ = fmt.Fprintf(w, "HELLO: %+v", b.jsonData)
	}), nil
}

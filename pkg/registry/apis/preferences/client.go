package preferences

import (
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

type clientGetter struct {
	clientGenerator resource.ClientGenerator
	once            sync.Once
	client          *preferences.PreferencesClient
	err             error
}

// We need to delay initialization until after the service has started
func (c *clientGetter) Get() (*preferences.PreferencesClient, error) {
	c.once.Do(func() {
		c.client, c.err = preferences.NewPreferencesClientFromGenerator(c.clientGenerator)
	})
	return c.client, c.err
}

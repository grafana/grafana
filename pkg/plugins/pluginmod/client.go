package pluginmod

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins"
)

var _ services.Service = (*Client)(nil)
var _ PluginManager = (*Client)(nil)

type Client struct {
	*services.BasicService
}

func NewClient() *Client {
	c := &Client{}
	c.BasicService = services.NewBasicService(c.start, c.run, c.stop)
	fmt.Println("Creating client service...")
	return c
}

func (c *Client) start(ctx context.Context) error {
	fmt.Println("Starting client...")
	return nil
}

func (c *Client) run(ctx context.Context) error {
	fmt.Println("Running client...")
	<-ctx.Done()
	return nil
}

func (c *Client) stop(err error) error {
	fmt.Println("Stopping client...")
	return err
}

func (c *Client) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	//TODO implement me
	panic("implement me")
}

func (c *Client) Remove(ctx context.Context, pluginID string) error {
	//TODO implement me
	panic("implement me")
}

func (c *Client) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	//TODO implement me
	panic("implement me")
}

func (c *Client) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	//TODO implement me
	panic("implement me")
}

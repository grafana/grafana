package pluginmod

import (
	"context"
	"errors"
	"fmt"
	"io"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	pluginProto "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginmod/proto"
	"github.com/grafana/grafana/pkg/setting"
)

var _ services.Service = (*Client)(nil)
var _ PluginManager = (*Client)(nil)

var errNotImplemented = errors.New("ErrMethodNotImplemented")

type Client struct {
	*services.BasicService

	cfg *setting.Cfg
	log log.Logger

	pm pluginProto.PluginManagerClient
	qc pluginv2.DataClient
	dc pluginv2.DiagnosticsClient
	sc pluginv2.StreamClient
	rc pluginv2.ResourceClient
}

func newPluginManagerClient(cfg *setting.Cfg) *Client {
	c := &Client{
		cfg: cfg,
		log: log.New("plugins.client"),
	}
	c.BasicService = services.NewBasicService(c.start, c.run, c.stop)

	return c
}

func (c *Client) start(_ context.Context) error {
	c.log.Info("Starting client...")

	opts := []grpc.DialOption{grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024 * 1024 * 16))}

	if c.cfg.GRPCServerTLSConfig == nil {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		opts = append(opts, grpc.WithTransportCredentials(
			credentials.NewTLS(c.cfg.GRPCServerTLSConfig)))
	}

	c.log.Info("Connection to gRPC server", "address", c.cfg.GRPCServerAddress)

	conn, err := grpc.Dial(c.cfg.GRPCServerAddress, opts...)
	if err != nil {
		return err
	}

	c.qc = pluginv2.NewDataClient(conn)
	c.dc = pluginv2.NewDiagnosticsClient(conn)
	c.sc = pluginv2.NewStreamClient(conn)
	c.rc = pluginv2.NewResourceClient(conn)
	c.pm = pluginProto.NewPluginManagerClient(conn)

	c.log.Info("Connection status", "status", conn.GetState().String())

	return nil
}

func (c *Client) run(ctx context.Context) error {
	c.log.Info("Running client...")
	<-ctx.Done()
	return nil
}

func (c *Client) stop(err error) error {
	c.log.Info("Stopping client...")
	return err
}

func (c *Client) Plugin(ctx context.Context, id string) (plugins.PluginDTO, bool) {
	p, err := c.pm.GetPlugin(ctx, &pluginProto.GetPluginRequest{
		Id: id,
	})
	if err != nil {
		c.log.Error("Error occurred when fetching plugin", "pluginID", id, "err", err)
		return plugins.PluginDTO{}, false
	}

	return fromProto(p.Plugin), true
}

func (c *Client) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	var types []string
	for _, t := range pluginTypes {
		types = append(types, string(t))
	}
	resp, err := c.pm.GetPlugins(ctx, &pluginProto.GetPluginsRequest{
		Types: types,
	})
	if err != nil {
		c.log.Error("Error occurred when fetching plugins", "err", err)
		return []plugins.PluginDTO{}
	}

	var res []plugins.PluginDTO
	for _, p := range resp.Plugins {
		res = append(res, fromProto(p))
	}
	return res
}

func (c *Client) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	resp, err := c.pm.AddPlugin(ctx, &pluginProto.AddPluginRequest{
		Id:      pluginID,
		Version: version,
		Opts: &pluginProto.AddPluginOpts{
			GrafanaVersion: opts.GrafanaVersion,
			Os:             opts.OS,
			Arch:           opts.Arch,
		},
	})
	if err != nil {
		return err
	}

	if !resp.OK {
		return errors.New("could not add plugin")
	}

	return nil
}

func (c *Client) Remove(ctx context.Context, pluginID string) error {
	resp, err := c.pm.RemovePlugin(ctx, &pluginProto.RemovePluginRequest{
		Id: pluginID,
	})
	if err != nil {
		return err
	}

	if !resp.OK {
		return errors.New("could not remove plugin")
	}

	return nil
}

func (c *Client) Renderer(ctx context.Context) *plugins.Plugin {
	return nil //TODO
}

func (c *Client) SecretsManager(ctx context.Context) *plugins.Plugin {
	return nil //TODO
}

func (c *Client) Routes() []*plugins.StaticRoute {
	staticRoutes, err := c.pm.StaticRoute(context.Background(), &pluginProto.GetStaticRoutesRequest{})
	if err != nil {
		c.log.Error("Error occurred when fetching plugin errors", "err", err)
		return []*plugins.StaticRoute{}
	}

	var res []*plugins.StaticRoute
	for _, staticRoute := range staticRoutes.StaticRoutes {
		res = append(res, &plugins.StaticRoute{
			PluginID:  staticRoute.Id,
			Directory: staticRoute.Directory,
		})
	}
	return res
}

func (c *Client) PluginErrors() []*plugins.Error {
	pluginErrs, err := c.pm.PluginErrors(context.Background(), &pluginProto.GetPluginErrorsRequest{})
	if err != nil {
		c.log.Error("Error occurred when fetching plugin errors", "err", err)
		return []*plugins.Error{}
	}

	res := make([]*plugins.Error, 0)
	for _, pluginError := range pluginErrs.PluginErrors {
		res = append(res, &plugins.Error{
			ErrorCode: plugins.ErrorCode(pluginError.Error),
			PluginID:  pluginError.Id,
		})
	}
	return res
}

func (c *Client) File(ctx context.Context, pluginID, filename string) (*plugins.File, error) {
	res, err := c.pm.File(ctx, &pluginProto.GetPluginFileRequest{
		Id:   pluginID,
		File: filename,
	})
	if err != nil {
		return nil, err
	}

	return &plugins.File{
		Content: res.File,
		ModTime: res.ModTime.AsTime(),
	}, nil
}

func (c *Client) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.qc == nil {
		return nil, errNotImplemented
	}

	protoReq := backend.ToProto().QueryDataRequest(req)
	protoResp, err := c.qc.QueryData(ctx, protoReq)

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return nil, errNotImplemented
		}

		return nil, fmt.Errorf("%v: %w", "Failed to query data", err)
	}

	return backend.FromProto().QueryDataResponse(protoResp)
}

func (c *Client) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if c.rc == nil {
		return errNotImplemented
	}

	protoReq := backend.ToProto().CallResourceRequest(req)
	protoStream, err := c.rc.CallResource(ctx, protoReq)
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return errNotImplemented
		}

		return fmt.Errorf("%v: %w", "Failed to call resource", err)
	}

	for {
		protoResp, err := protoStream.Recv()
		if err != nil {
			if status.Code(err) == codes.Unimplemented {
				return errNotImplemented
			}

			if errors.Is(err, io.EOF) {
				return nil
			}

			return fmt.Errorf("%v: %w", "failed to receive call resource response", err)
		}

		if err := sender.Send(backend.FromProto().CallResourceResponse(protoResp)); err != nil {
			return err
		}
	}
}

func (c *Client) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if c.dc == nil {
		return nil, errNotImplemented
	}

	protoContext := backend.ToProto().PluginContext(req.PluginContext)
	protoResp, err := c.dc.CheckHealth(ctx, &pluginv2.CheckHealthRequest{PluginContext: protoContext, Headers: req.Headers})

	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusUnknown,
				Message: "Health check not implemented",
			}, nil
		}
		return nil, err
	}

	return backend.FromProto().CheckHealthResponse(protoResp), nil
}

func (c *Client) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if c.dc == nil {
		return &backend.CollectMetricsResult{}, nil
	}

	protoResp, err := c.dc.CollectMetrics(ctx, backend.ToProto().CollectMetricsRequest(req))
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &backend.CollectMetricsResult{}, nil
		}

		return nil, err
	}

	return backend.FromProto().CollectMetricsResponse(protoResp), nil
}

func (c *Client) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if c.sc == nil {
		return nil, errNotImplemented
	}
	protoResp, err := c.sc.SubscribeStream(ctx, backend.ToProto().SubscribeStreamRequest(req))
	if err != nil {
		return nil, err
	}
	return backend.FromProto().SubscribeStreamResponse(protoResp), nil
}

func (c *Client) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if c.sc == nil {
		return nil, errNotImplemented
	}
	protoResp, err := c.sc.PublishStream(ctx, backend.ToProto().PublishStreamRequest(req))
	if err != nil {
		return nil, err
	}
	return backend.FromProto().PublishStreamResponse(protoResp), nil
}

func (c *Client) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if c.sc == nil {
		return errNotImplemented
	}

	protoReq := backend.ToProto().RunStreamRequest(req)
	protoStream, err := c.sc.RunStream(ctx, protoReq)
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return errNotImplemented
		}
		return fmt.Errorf("%v: %w", "Failed to call resource", err)
	}

	for {
		p, err := protoStream.Recv()
		if err != nil {
			if status.Code(err) == codes.Unimplemented {
				return errNotImplemented
			}
			if errors.Is(err, io.EOF) {
				return nil
			}
			return fmt.Errorf("error running stream: %w", err)
		}
		// From GRPC connection we receive already prepared JSON.
		err = sender.SendJSON(p.Data)
		if err != nil {
			return err
		}
	}
}

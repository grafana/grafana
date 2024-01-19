package pluginclientimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginclient"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/validations"
)

type Facade struct {
	client           plugins.Client
	provider         *plugincontext.Provider
	requestValidator validations.PluginRequestValidator
}

func ProvideService(client plugins.Client, provider *plugincontext.Provider, requestValidator validations.PluginRequestValidator) *Facade {
	return &Facade{
		client:           client,
		provider:         provider,
		requestValidator: requestValidator,
	}
}

func (f *Facade) QueryData(ctx context.Context, req *pluginclient.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return nil, errors.New("req cannot be nil")
	}

	pCtx, err := f.getPluginContext(ctx, req.Reference)
	if err != nil {
		return nil, err
	}

	sdkReq := &backend.QueryDataRequest{
		PluginContext: *pCtx,
		Headers:       req.Headers,
		Queries:       req.Queries,
	}

	return f.client.QueryData(ctx, sdkReq)
}

func (f *Facade) CheckHealth(ctx context.Context, req *pluginclient.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return nil, errors.New("req cannot be nil")
	}

	pCtx, err := f.getPluginContext(ctx, req.Reference)
	if err != nil {
		return nil, err
	}

	sdkReq := &backend.CheckHealthRequest{
		PluginContext: *pCtx,
		Headers:       req.Headers,
	}

	return f.client.CheckHealth(ctx, sdkReq)
}

func (f *Facade) CallResource(ctx context.Context, req *pluginclient.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return errors.New("req cannot be nil")
	}

	if sender == nil {
		return errors.New("sender cannot be nil")
	}

	pCtx, err := f.getPluginContext(ctx, req.Reference)
	if err != nil {
		return err
	}

	if req.Validate != nil {
		if err = req.Validate(ctx, *pCtx); err != nil {
			return err
		}
	}

	sdkReq := &backend.CallResourceRequest{
		PluginContext: *pCtx,
		Path:          req.Path,
		Method:        req.Method,
		URL:           req.URL,
		Headers:       req.Headers,
		Body:          req.Body,
	}

	return f.client.CallResource(ctx, sdkReq, sender)
}

func (f *Facade) CollectMetrics(ctx context.Context, req *pluginclient.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return nil, errors.New("req cannot be nil")
	}

	pCtx, err := f.getPluginContext(ctx, req.Reference)
	if err != nil {
		return nil, err
	}

	sdkReq := &backend.CollectMetricsRequest{
		PluginContext: *pCtx,
	}

	return f.client.CollectMetrics(ctx, sdkReq)
}

func (f *Facade) getPluginContext(ctx context.Context, ref pluginclient.PluginReference) (*backend.PluginContext, error) {
	if ref == nil {
		return nil, errors.New("req.PluginReference cannot be nil")
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	var pCtx backend.PluginContext
	if dsRef, ok := ref.(pluginclient.DatasourceReference); ok {
		pCtx, err = f.provider.GetWithDataSource(ctx, ref.PluginID(), user, dsRef.Datasource())
		if err != nil {
			return nil, err
		}

		if err := f.validateDatasourceRequest(ctx, pCtx); err != nil {
			return nil, err
		}

		return &pCtx, nil
	}

	pCtx, err = f.provider.Get(ctx, ref.PluginID(), user, user.OrgID)
	if err != nil {
		return nil, err
	}

	return &pCtx, nil
}

func (f *Facade) validateDatasourceRequest(ctx context.Context, pCtx backend.PluginContext) error {
	reqCtx := contexthandler.FromContext(ctx)

	if reqCtx == nil || reqCtx.Req == nil || pCtx.DataSourceInstanceSettings == nil {
		return nil
	}

	return f.requestValidator.Validate(pCtx.DataSourceInstanceSettings.URL, reqCtx.Req)
}

var _ pluginclient.Client = &Facade{}

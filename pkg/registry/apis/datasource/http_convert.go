package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/web"
)

func convertQueryDataRequest(ctx context.Context, req *http.Request, client backend.ConversionHandler, provider PluginContextWrapper) (*dsV0.QueryDataRequest, error) {
	dqr := data.QueryDataRequest{}
	err := web.Bind(req, &dqr)
	if err != nil {
		return nil, RequestError(err)
	}
	if len(dqr.Queries) == 0 || dqr.Queries[0].Datasource == nil {
		return nil, apierrors.NewBadRequest("conversion requires a datasource reference")
	}

	ds := dqr.Queries[0].Datasource
	for _, query := range dqr.Queries[1:] {
		if query.Datasource == nil {
			return nil, apierrors.NewBadRequest("conversion requires a datasource reference for every query")
		}
		if query.Datasource.Type != ds.Type || query.Datasource.UID != ds.UID {
			return nil, apierrors.NewBadRequest("conversion queries must reference the same datasource type and UID")
		}
	}
	pluginCtx, err := provider.PluginContextForDataSource(ctx, &backend.DataSourceInstanceSettings{
		Type:       ds.Type,
		UID:        ds.UID,
		APIVersion: ds.APIVersion,
	})
	if err != nil {
		return nil, err
	}

	ctx = config.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	raw, err := json.Marshal(dqr)
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("marshal: %w", err))
	}
	convertRequest := &backend.ConversionRequest{
		PluginContext: pluginCtx,
		Objects: []backend.RawObject{
			{
				Raw:         raw,
				ContentType: "application/json",
			},
		},
	}

	convertResponse, err := client.ConvertObjects(ctx, convertRequest)
	if err != nil {
		var status apierrors.APIStatus
		if errors.As(err, &status) {
			return nil, &apierrors.StatusError{ErrStatus: status.Status()}
		}
		if convertResponse != nil && convertResponse.Result != nil {
			return nil, apierrors.NewInternalError(fmt.Errorf("conversion failed. Err: %w. Result: %s", err, convertResponse.Result.Message))
		}
		return nil, err
	}

	qr := &dsV0.QueryDataRequest{}
	for _, obj := range convertResponse.Objects {
		if obj.ContentType != "application/json" {
			return nil, apierrors.NewInternalError(fmt.Errorf("unexpected content type: %s", obj.ContentType))
		}
		q := &data.DataQuery{}
		err = json.Unmarshal(obj.Raw, q)
		if err != nil {
			return nil, apierrors.NewInternalError(fmt.Errorf("unmarshal: %w", err))
		}
		qr.Queries = append(qr.Queries, *q)
	}

	return qr, nil
}

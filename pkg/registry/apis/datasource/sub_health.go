package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"go.opentelemetry.io/otel/attribute"
)

type subHealthREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ = rest.Connecter(&subHealthREST{})
	_ = rest.StorageMetadata(&subHealthREST{})
)

func (r *subHealthREST) New() runtime.Object {
	return &datasource.HealthCheckResult{}
}

func (r *subHealthREST) Destroy() {
}

func (r *subHealthREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subHealthREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subHealthREST) ProducesObject(verb string) interface{} {
	return &datasource.HealthCheckResult{}
}

func (r *subHealthREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subHealthREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, connectSpan := tracing.Start(ctx, "datasource.health.connect",
		attribute.String("namespace", namespace),
		attribute.String("plugin_id", r.builder.pluginJSON.ID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("health", r.builder.pluginJSON.ID)

	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		err = tracing.Error(connectSpan, err)
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			m.SetNotFound()
			m.Record()
			return nil, r.builder.datasourceResourceInfo.NewNotFound(name)
		}
		m.SetError()
		m.Record()
		return nil, err
	}
	ctx = config.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = contextualMiddlewares(ctx)

	checkHealthCtx, checkHealthSpan := tracing.Start(ctx, "datasource.health.pluginClient.CheckHealth")
	healthResponse, err := r.builder.client.CheckHealth(checkHealthCtx, &backend.CheckHealthRequest{
		PluginContext: pluginCtx,
	})
	checkHealthSpan.End()
	if err != nil {
		err = tracing.Error(connectSpan, err)
		m.SetError()
		m.Record()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()

		_, reqSpan := tracing.Start(req.Context(), "datasource.health.request",
			attribute.String("namespace", namespace),
			attribute.String("plugin_id", r.builder.pluginJSON.ID),
			attribute.String("datasource_uid", name),
		)
		defer reqSpan.End()

		rsp := &datasource.HealthCheckResult{}
		rsp.Code = int(healthResponse.Status)
		rsp.Status = healthResponse.Status.String()
		rsp.Message = healthResponse.Message

		if len(healthResponse.JSONDetails) > 0 {
			err := json.Unmarshal(healthResponse.JSONDetails, &rsp.Details)
			if err != nil {
				_ = tracing.Error(reqSpan, err)
				m.SetError()
				responder.Error(err)
				return
			}
		}

		statusCode := http.StatusOK
		if healthResponse.Status != backend.HealthStatusOk {
			m.SetError()
			statusCode = http.StatusBadRequest
		}
		responder.Object(statusCode, rsp)
	}), nil
}

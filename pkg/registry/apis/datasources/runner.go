package datasources

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
)

// Authz should already be applied!!!
func (b *DSAPIBuilder) doSubresource(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ns, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	info, ok := request.RequestInfoFrom(ctx)
	if !ok {
		err = errutil.BadRequest("missing k8s request info")
		errhttp.Write(ctx, err, w)
		return
	}

	ds, err := b.getDataSource(ctx, info.Name)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	if ds == nil {
		err = errutil.BadRequest("missing datasource")
		errhttp.Write(ctx, err, w)
		return
	}

	settings := backend.DataSourceInstanceSettings{}
	settings.ID = ds.ID
	settings.UID = ds.UID
	settings.Name = ds.Name
	settings.URL = ds.URL
	settings.Updated = ds.Updated
	settings.User = ds.User
	settings.JSONData, err = ds.JsonData.ToDB()
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	settings.DecryptedSecureJSONData, err = b.dsService.DecryptedValues(ctx, ds)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	pluginCtx := &backend.PluginContext{
		OrgID:                      ns.OrgID,
		PluginID:                   b.plugin.ID,
		PluginVersion:              b.plugin.Info.Version,
		User:                       &backend.User{},
		AppInstanceSettings:        &backend.AppInstanceSettings{},
		DataSourceInstanceSettings: &settings,
	}

	switch info.Subresource {
	case "query":
		if r.Method != "POST" {
			err = errutil.BadRequest("use POST for query!")
			errhttp.Write(ctx, err, w)
			return
		}
		b.executeQueryHandler(ctx, w, r, pluginCtx)
	case "health":
		b.executeHealthHandler(ctx, w, r, pluginCtx)
	case "resource":
		b.executeCallResourceHandler(ctx, w, r, pluginCtx)
	default:
		out, _ := json.MarshalIndent(info, "", "  ")
		_, _ = w.Write(out)
	}
}

func (b *DSAPIBuilder) executeCallResourceHandler(ctx context.Context, w http.ResponseWriter, req *http.Request, pluginCtx *backend.PluginContext) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		klog.Errorf("CallResourceRequest body was malformed: %s", err)
		w.WriteHeader(400)
		_, _ = w.Write([]byte("CallResourceRequest body was malformed"))
		return
	}

	idx := strings.LastIndex(req.URL.Path, "/resource")
	if idx < 0 {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("expected resource path"))
		return
	}
	path := req.URL.Path[idx+len("/resource"):]

	err = b.client.CallResource(ctx, &backend.CallResourceRequest{
		PluginContext: *pluginCtx,
		Path:          path,
		Method:        req.Method,
		Body:          body,
	}, httpresponsesender.New(w))

	if err != nil {
		errhttp.Write(ctx, err, w)
	}
}

func (b *DSAPIBuilder) executeHealthHandler(ctx context.Context, w http.ResponseWriter, _ *http.Request, pluginCtx *backend.PluginContext) {
	healthResponse, err := b.client.CheckHealth(ctx, &backend.CheckHealthRequest{
		PluginContext: *pluginCtx,
	})

	if err != nil {
		// our wrappedSender func will likely never be invoked for errors
		// respond with a 400
		w.WriteHeader(400)
		errhttp.Write(ctx, err, w)
		klog.Errorf("encountered error invoking CheckHealth: %v", err)
		_, _ = w.Write([]byte("encountered error invoking CheckHealth"))
	}

	jsonRsp, err := json.Marshal(healthResponse)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	w.WriteHeader(200)
	_, _ = w.Write(jsonRsp)
}

func (b *DSAPIBuilder) executeQueryHandler(ctx context.Context, w http.ResponseWriter, req *http.Request, pluginCtx *backend.PluginContext) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		klog.Errorf("QueryDataRequest was malformed: %s", err)
		w.WriteHeader(400)
		_, _ = w.Write([]byte("QueryDataRequest was malformed"))
		return
	}
	queries, err := readQueries(body)
	if err != nil {
		klog.Errorf("Could not parse QueryDataRequest: %s", err)
		w.WriteHeader(400)
		_, _ = w.Write([]byte("Could not parse QueryDataRequest"))
		return
	}

	queryResponse, err := b.client.QueryData(ctx, &backend.QueryDataRequest{
		PluginContext: *pluginCtx,
		Queries:       queries,
		//  Headers: // from context
	})
	if err != nil {
		return
	}

	jsonRsp, err := json.Marshal(queryResponse)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	w.WriteHeader(200)
	_, _ = w.Write(jsonRsp)
}

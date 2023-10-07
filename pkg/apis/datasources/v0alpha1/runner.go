package v0alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/datasources"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/klog/v2"
)

// Authz should already be applied!!!
func (b *DSAPIBuilder) doSubresource(w http.ResponseWriter, r *http.Request) {
	info, ok := request.RequestInfoFrom(r.Context())
	if !ok {
		fmt.Printf("ERROR!!!!")
		return
	}
	orgId, ok := grafanarequest.ParseOrgID(info.Namespace)
	if !ok {
		fmt.Printf("bad org")
		return
	}

	ctx := r.Context()
	ds, err := b.dsService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		OrgID: orgId,
		UID:   info.Name,
	})
	if err != nil {
		fmt.Printf("ERROR!!!! %v", err)
		return
	}
	if ds == nil {
		klog.Errorf("missing datasource: %s", err)
		w.WriteHeader(400)
		w.Write([]byte("missing datasource"))
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
		fmt.Printf("ERROR!!!! %v", ds)
		return
	}

	settings.DecryptedSecureJSONData, err = b.dsService.DecryptedValues(ctx, ds)
	if err != nil {
		fmt.Printf("ERROR!!!! %v", err)
		return
	}
	pluginCtx := &backend.PluginContext{
		OrgID:                      orgId,
		PluginID:                   b.plugin.ID,
		PluginVersion:              b.plugin.Info.Version,
		User:                       &backend.User{},
		AppInstanceSettings:        &backend.AppInstanceSettings{},
		DataSourceInstanceSettings: &settings,
	}

	switch info.Subresource {
	case "query":
		if r.Method != "POST" {
			w.WriteHeader(400)
			w.Write([]byte("use POST for query!"))
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

type callResourceResponseSenderFunc func(res *backend.CallResourceResponse) error

func (fn callResourceResponseSenderFunc) Send(res *backend.CallResourceResponse) error {
	return fn(res)
}

func (b *DSAPIBuilder) executeCallResourceHandler(ctx context.Context, w http.ResponseWriter, req *http.Request, pluginCtx *backend.PluginContext) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		klog.Errorf("CallResourceRequest body was malformed: %s", err)
		w.WriteHeader(400)
		w.Write([]byte("CallResourceRequest body was malformed"))
		return
	}

	wrappedSender := callResourceResponseSenderFunc(func(response *backend.CallResourceResponse) error {
		w.WriteHeader(response.Status)
		for key, headerValues := range response.Headers {
			for _, value := range headerValues {
				w.Header().Set(key, value)
			}
		}
		w.Write(response.Body)
		return nil
	})

	idx := strings.LastIndex(req.URL.Path, "/resource")
	if idx < 0 {
		w.WriteHeader(400)
		w.Write([]byte("expected resource path"))
		return
	}
	path := req.URL.Path[idx+len("/resource"):]

	err = b.client.CallResource(ctx, &backend.CallResourceRequest{
		PluginContext: *pluginCtx,
		Path:          path,
		Method:        req.Method,
		Body:          body,
	}, wrappedSender)

	if err != nil {
		// our wrappedSender func will likely never be invoked for errors
		// respond with a 400
		w.WriteHeader(400)
		w.Write([]byte("encountered error invoking CallResponseHandler for request"))
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
		klog.Errorf("encountered error invoking CheckHealth: %v", err)
		w.Write([]byte("encountered error invoking CheckHealth"))
	}

	jsonRsp, err := json.Marshal(healthResponse)
	if err != nil {
		return
	}
	w.WriteHeader(200)
	w.Write(jsonRsp)
}

func (b *DSAPIBuilder) executeQueryHandler(ctx context.Context, w http.ResponseWriter, req *http.Request, pluginCtx *backend.PluginContext) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		klog.Errorf("QueryDataRequest was malformed: %s", err)
		w.WriteHeader(400)
		w.Write([]byte("QueryDataRequest was malformed"))
		return
	}
	queries, err := readQueries(body)
	if err != nil {
		klog.Errorf("Could not parse QueryDataRequest: %s", err)
		w.WriteHeader(400)
		w.Write([]byte("Could not parse QueryDataRequest"))
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
		return
	}
	w.WriteHeader(200)
	w.Write(jsonRsp)
}

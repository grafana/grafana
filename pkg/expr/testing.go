package expr

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
)

type fakePluginContextProvider struct {
	recordings []struct {
		method string
		params []interface{}
	}
	result      map[string]*backend.AppInstanceSettings
	errorResult error
}

var _ pluginContextProvider = &fakePluginContextProvider{}

func (f *fakePluginContextProvider) Get(_ context.Context, pluginID string, user *user.SignedInUser, orgID int64) (backend.PluginContext, error) {
	f.recordings = append(f.recordings, struct {
		method string
		params []interface{}
	}{method: "Get", params: []interface{}{pluginID, user, orgID}})
	if f.errorResult != nil {
		return backend.PluginContext{}, f.errorResult
	}
	var u *backend.User
	if user != nil {
		u = &backend.User{
			Login: user.Login,
			Name:  user.Name,
			Email: user.Email,
		}
	}
	return backend.PluginContext{
		OrgID:                      orgID,
		PluginID:                   pluginID,
		User:                       u,
		AppInstanceSettings:        f.result[pluginID],
		DataSourceInstanceSettings: nil,
	}, nil
}

func (f *fakePluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user *user.SignedInUser, ds *datasources.DataSource) (backend.PluginContext, error) {
	f.recordings = append(f.recordings, struct {
		method string
		params []interface{}
	}{method: "GetWithDataSource", params: []interface{}{pluginID, user, ds}})

	if f.errorResult != nil {
		return backend.PluginContext{}, f.errorResult
	}

	orgId := int64(1)
	if user != nil {
		orgId = user.OrgID
	}
	r, err := f.Get(ctx, pluginID, user, orgId)
	if ds != nil {
		r.DataSourceInstanceSettings = &backend.DataSourceInstanceSettings{
			ID:   ds.ID,
			UID:  ds.UID,
			Type: ds.Type,
			Name: ds.Name,
		}
	}
	return r, err
}

type recordingCallResourceHandler struct {
	recordings []*backend.CallResourceRequest
	response   *backend.CallResourceResponse
}

var _ backend.CallResourceHandler = &recordingCallResourceHandler{}

func (f *recordingCallResourceHandler) CallResource(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	f.recordings = append(f.recordings, req)
	return sender.Send(f.response)
}

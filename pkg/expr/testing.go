package expr

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type fakePluginContextProvider struct {
	recordings []struct {
		method string
		params []any
	}
	result      map[string]*backend.AppInstanceSettings
	errorResult error
}

var _ pluginContextProvider = &fakePluginContextProvider{}

func (f *fakePluginContextProvider) Get(_ context.Context, pluginID string, user identity.Requester, orgID int64) (backend.PluginContext, error) {
	f.recordings = append(f.recordings, struct {
		method string
		params []any
	}{method: "Get", params: []any{pluginID, user, orgID}})
	if f.errorResult != nil {
		return backend.PluginContext{}, f.errorResult
	}
	var u *backend.User
	if user != nil {
		u = &backend.User{
			Login: user.GetLogin(),
			Name:  user.GetName(),
			Email: user.GetEmail(),
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

func (f *fakePluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	f.recordings = append(f.recordings, struct {
		method string
		params []any
	}{method: "GetWithDataSource", params: []any{pluginID, user, ds}})

	if f.errorResult != nil {
		return backend.PluginContext{}, f.errorResult
	}

	orgId := int64(1)
	if user != nil {
		orgId = user.GetOrgID()
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

func newScalar(value *float64) mathexp.Scalar {
	n := mathexp.NewScalar("", value)
	return n
}

func newNumber(labels data.Labels, value *float64) mathexp.Number {
	n := mathexp.NewNumber("", labels)
	n.SetValue(value)
	return n
}

func newSeries(points ...float64) mathexp.Series {
	series := mathexp.NewSeries("", nil, len(points))
	for idx, point := range points {
		p := point
		series.SetPoint(idx, time.Unix(int64(idx), 0), &p)
	}
	return series
}

func newSeriesPointer(points ...*float64) mathexp.Series {
	series := mathexp.NewSeries("", nil, len(points))
	for idx, point := range points {
		series.SetPoint(idx, time.Unix(int64(idx), 0), point)
	}
	return series
}

func newSeriesWithLabels(labels data.Labels, values ...*float64) mathexp.Series {
	series := mathexp.NewSeries("", labels, len(values))
	for idx, value := range values {
		series.SetPoint(idx, time.Unix(int64(idx), 0), value)
	}
	return series
}

func newResults(values ...mathexp.Value) mathexp.Results {
	return mathexp.Results{Values: values}
}

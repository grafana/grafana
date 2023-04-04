package service

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/dashboards"
	dashmodels "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
)

func TestGetPluginDashboards(t *testing.T) {
	testDashboardOld := simplejson.New()
	testDashboardOld.Set("title", "Nginx Connections")
	testDashboardOld.Set("revision", 22)

	testDashboardNew := simplejson.New()
	testDashboardNew.Set("title", "Nginx Connections")
	testDashboardNew.Set("revision", 23)
	testDashboardNewBytes, err := testDashboardNew.MarshalJSON()
	require.NoError(t, err)

	testDashboardDeleted := simplejson.New()
	testDashboardDeleted.Set("title", "test")
	testDashboardDeleted.Set("id", 4)

	pluginDashboardStore := &pluginDashboardStoreMock{
		pluginDashboardFiles: map[string]map[string][]byte{
			"test-app": {
				"nginx-connections": testDashboardNewBytes,
			},
		},
	}
	dashboardPluginService := &dashboardPluginServiceMock{
		pluginDashboards: map[string][]*dashmodels.Dashboard{
			"test-app": {
				dashmodels.NewDashboardFromJson(testDashboardOld),
				dashmodels.NewDashboardFromJson(testDashboardDeleted),
			},
		},
	}

	s := ProvideService(pluginDashboardStore, dashboardPluginService)
	require.NotNil(t, s)

	t.Run("LoadPluginDashboard", func(t *testing.T) {
		testCases := []struct {
			desc        string
			req         *plugindashboards.LoadPluginDashboardRequest
			errorFn     require.ErrorAssertionFunc
			respValueFn require.ValueAssertionFunc
			validateFn  func(tt *testing.T, resp *plugindashboards.LoadPluginDashboardResponse)
		}{
			{
				desc:        "Should return error for nil req",
				req:         nil,
				errorFn:     require.Error,
				respValueFn: require.Nil,
			},
			{
				desc: "Should return error for non-existing plugin",
				req: &plugindashboards.LoadPluginDashboardRequest{
					PluginID: "non-existing",
				},
				errorFn:     require.Error,
				respValueFn: require.Nil,
			},
			{
				desc: "Should return error for non-existing file reference",
				req: &plugindashboards.LoadPluginDashboardRequest{
					PluginID:  "test-app",
					Reference: "non-existing",
				},
				errorFn:     require.Error,
				respValueFn: require.Nil,
			},
			{
				desc: "Should return expected loaded dashboard model",
				req: &plugindashboards.LoadPluginDashboardRequest{
					PluginID:  "test-app",
					Reference: "nginx-connections",
				},
				errorFn:     require.NoError,
				respValueFn: require.NotNil,
				validateFn: func(tt *testing.T, resp *plugindashboards.LoadPluginDashboardResponse) {
					require.NotNil(tt, resp.Dashboard)
					require.Equal(tt, testDashboardNew.Get("title").MustString(), resp.Dashboard.Title)
					require.Equal(tt, testDashboardNew.Get("revision").MustInt64(1), resp.Dashboard.Data.Get("revision").MustInt64(1))
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				resp, err := s.LoadPluginDashboard(context.Background(), tc.req)
				tc.errorFn(t, err)
				tc.respValueFn(t, resp)

				if resp != nil {
					tc.validateFn(t, resp)
				}
			})
		}
	})

	t.Run("ListPluginDashboards", func(t *testing.T) {
		testCases := []struct {
			desc        string
			req         *plugindashboards.ListPluginDashboardsRequest
			errorFn     require.ErrorAssertionFunc
			respValueFn require.ValueAssertionFunc
			validateFn  func(tt *testing.T, resp *plugindashboards.ListPluginDashboardsResponse)
		}{
			{
				desc:        "Should return error for nil req",
				req:         nil,
				errorFn:     require.Error,
				respValueFn: require.Nil,
			},
			{
				desc: "Should return error for non-existing plugin",
				req: &plugindashboards.ListPluginDashboardsRequest{
					PluginID: "non-existing",
				},
				errorFn:     require.Error,
				respValueFn: require.Nil,
			},
			{
				desc: "Should return updated nginx dashboard revision and removed title dashboard",
				req: &plugindashboards.ListPluginDashboardsRequest{
					PluginID: "test-app",
				},
				errorFn:     require.NoError,
				respValueFn: require.NotNil,
				validateFn: func(tt *testing.T, resp *plugindashboards.ListPluginDashboardsResponse) {
					require.Len(tt, resp.Items, 2)
					nginx := resp.Items[0]
					require.True(tt, nginx.Imported)
					require.Equal(t, int64(23), nginx.Revision)
					require.Equal(t, int64(22), nginx.ImportedRevision)
					require.Equal(tt, testDashboardOld.Get("title").MustString(), nginx.Title)
					test := resp.Items[1]
					require.True(tt, test.Removed)
				},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				resp, err := s.ListPluginDashboards(context.Background(), tc.req)
				tc.errorFn(t, err)
				tc.respValueFn(t, resp)

				if resp != nil {
					tc.validateFn(t, resp)
				}
			})
		}
	})
}

type pluginDashboardStoreMock struct {
	pluginDashboardFiles map[string]map[string][]byte
}

func (m pluginDashboardStoreMock) ListPluginDashboardFiles(ctx context.Context, args *dashboards.ListPluginDashboardFilesArgs) (*dashboards.ListPluginDashboardFilesResult, error) {
	if dashboardFiles, exists := m.pluginDashboardFiles[args.PluginID]; exists {
		references := []string{}

		for ref := range dashboardFiles {
			references = append(references, ref)
		}

		sort.Strings(references)

		return &dashboards.ListPluginDashboardFilesResult{
			FileReferences: references,
		}, nil
	}

	return nil, plugins.NotFoundError{PluginID: args.PluginID}
}

func (m pluginDashboardStoreMock) GetPluginDashboardFileContents(ctx context.Context, args *dashboards.GetPluginDashboardFileContentsArgs) (*dashboards.GetPluginDashboardFileContentsResult, error) {
	if dashboardFiles, exists := m.pluginDashboardFiles[args.PluginID]; exists {
		if content, exists := dashboardFiles[args.FileReference]; exists {
			return &dashboards.GetPluginDashboardFileContentsResult{
				Content: content,
			}, nil
		}
	} else if !exists {
		return nil, plugins.NotFoundError{PluginID: args.PluginID}
	}

	return nil, fmt.Errorf("plugin dashboard file not found")
}

type dashboardPluginServiceMock struct {
	pluginDashboards map[string][]*dashmodels.Dashboard
	args             []*dashmodels.GetDashboardsByPluginIDQuery
}

func (d *dashboardPluginServiceMock) GetDashboardsByPluginID(ctx context.Context, query *dashmodels.GetDashboardsByPluginIDQuery) ([]*dashmodels.Dashboard, error) {
	queryResult := []*dashmodels.Dashboard{}

	if dashboards, exists := d.pluginDashboards[query.PluginID]; exists {
		queryResult = dashboards
	}

	if d.args == nil {
		d.args = []*dashmodels.GetDashboardsByPluginIDQuery{}
	}

	d.args = append(d.args, query)

	return queryResult, nil
}

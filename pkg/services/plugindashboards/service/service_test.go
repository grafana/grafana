package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/stretchr/testify/require"
)

func TestGetPluginDashboards(t *testing.T) {
	testDashboardOld := simplejson.New()
	testDashboardOld.Set("title", "Nginx Connections")
	testDashboardOld.Set("revision", 22)

	testDashboardNew := simplejson.New()
	testDashboardNew.Set("title", "Nginx Connections New")
	testDashboardNew.Set("revision", 23)
	testDashboardNewBytes, err := testDashboardNew.MarshalJSON()
	require.NoError(t, err)

	pluginDashboardStore := &pluginDashboardStoreMock{
		pluginDashboardFiles: map[string]map[string][]byte{
			"test-app": {
				"nginx-connections": testDashboardNewBytes,
			},
		},
	}
	dashboardPluginService := &dashboardPluginServiceMock{
		pluginDashboards: map[string][]*models.Dashboard{
			"test-app": {
				models.NewDashboardFromJson(testDashboardOld),
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
					require.Equal(tt, testDashboardNew.Get("revision").MustString(), resp.Dashboard.Data.Get("revision").MustString())
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

	})
	// 	cfg := &setting.Cfg{
	// 		PluginSettings: setting.PluginSettings{
	// 			"test-app": map[string]string{
	// 				"path": "testdata/test-app",
	// 			},
	// 		},
	// 	}
	// 	pmCfg := plugins.FromGrafanaCfg(cfg)
	// 	pm, err := ProvideService(cfg, loader.New(pmCfg, nil,
	// 		signature.NewUnsignedAuthorizer(pmCfg), &provider.Service{}))
	// 	require.NoError(t, err)

	// 	bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
	// 		if query.Slug == "nginx-connections" {
	// 			dash := models.NewDashboard("Nginx Connections")
	// 			dash.Data.Set("revision", "1.1")
	// 			query.Result = dash
	// 			return nil
	// 		}

	// 		return models.ErrDashboardNotFound
	// 	})

	// 	bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error {
	// 		var data = simplejson.New()
	// 		data.Set("title", "Nginx Connections")
	// 		data.Set("revision", 22)

	// 		query.Result = []*models.Dashboard{
	// 			{Slug: "nginx-connections", Data: data},
	// 		}
	// 		return nil
	// 	})

	// 	dashboards, err := pm.GetPluginDashboards(context.Background(), 1, "test-app")
	// 	require.NoError(t, err)

	// 	require.Len(t, dashboards, 2)
	// 	require.Equal(t, "Nginx Connections", dashboards[0].Title)
	// 	require.Equal(t, int64(25), dashboards[0].Revision)
	// 	require.Equal(t, int64(22), dashboards[0].ImportedRevision)
	// 	require.Equal(t, "db/nginx-connections", dashboards[0].ImportedUri)

	// 	require.Equal(t, int64(2), dashboards[1].Revision)
	// 	require.Equal(t, int64(0), dashboards[1].ImportedRevision)
}

type pluginDashboardStoreMock struct {
	pluginDashboardFiles map[string]map[string][]byte
}

func (m pluginDashboardStoreMock) ListPluginDashboardFiles(ctx context.Context, args *plugins.ListPluginDashboardFilesArgs) (*plugins.ListPluginDashboardFilesResult, error) {
	if dashboardFiles, exists := m.pluginDashboardFiles[args.PluginID]; exists {
		references := []string{}

		for ref := range dashboardFiles {
			references = append(references, ref)
		}

		return &plugins.ListPluginDashboardFilesResult{
			FileReferences: references,
		}, nil
	}

	return nil, plugins.NotFoundError{PluginID: args.PluginID}
}

func (m pluginDashboardStoreMock) GetPluginDashboardFileContent(ctx context.Context, args *plugins.GetPluginDashboardFileContentArgs) (*plugins.GetPluginDashboardFileContentResult, error) {
	spew.Dump(m.pluginDashboardFiles)
	if dashboardFiles, exists := m.pluginDashboardFiles[args.PluginID]; exists {
		if content, exists := dashboardFiles[args.FileReference]; exists {
			r := bytes.NewReader(content)
			return &plugins.GetPluginDashboardFileContentResult{
				Content: io.NopCloser(r),
			}, nil
		}
	} else if !exists {
		return nil, plugins.NotFoundError{PluginID: args.PluginID}
	}

	return nil, fmt.Errorf("plugin dashboard file not found")
}

type dashboardPluginServiceMock struct {
	pluginDashboards map[string][]*models.Dashboard
}

func (d dashboardPluginServiceMock) GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error {
	query.Result = []*models.Dashboard{}

	if dashboards, exists := d.pluginDashboards[query.PluginId]; exists {
		query.Result = dashboards
	}

	return nil
}

package tsdb

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	backendmodels "github.com/grafana/grafana/pkg/plugins/backendplugin/models"
	pluginmodels "github.com/grafana/grafana/pkg/plugins/models"
	"github.com/stretchr/testify/require"
)

func TestHandleRequest(t *testing.T) {
	t.Run("Should return query result when handling request for query", func(t *testing.T) {
		req := pluginmodels.DataQuery{
			Queries: []pluginmodels.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		svc, exe := createService()
		exe.Return("A", pluginmodels.DataTimeSeriesSlice{pluginmodels.DataTimeSeries{Name: "argh"}})

		res, err := svc.HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		require.NoError(t, err)
		require.NotEmpty(t, res.Results["A"].Series)
		require.Equal(t, "argh", res.Results["A"].Series[0].Name)
	})

	t.Run("Should return query results when handling request for two queries with same data source", func(t *testing.T) {
		req := pluginmodels.DataQuery{
			Queries: []pluginmodels.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
				{RefID: "B", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		svc, exe := createService()
		exe.Return("A", pluginmodels.DataTimeSeriesSlice{pluginmodels.DataTimeSeries{Name: "argh"}})
		exe.Return("B", pluginmodels.DataTimeSeriesSlice{pluginmodels.DataTimeSeries{Name: "barg"}})

		res, err := svc.HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		require.NoError(t, err)

		require.Len(t, res.Results, 2)
		require.Equal(t, "argh", res.Results["A"].Series[0].Name)
		require.Equal(t, "barg", res.Results["B"].Series[0].Name)
	})

	t.Run("Should return error when handling request for query with unknown type", func(t *testing.T) {
		svc, _ := createService()

		req := pluginmodels.DataQuery{
			Queries: []pluginmodels.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "asdasdas"}},
			},
		}
		_, err := svc.HandleRequest(context.TODO(), &models.DataSource{Id: 12, Type: "testjughjgjg"}, req)
		require.Error(t, err)
	})
}

type resultsFn func(context pluginmodels.DataQuery) pluginmodels.DataQueryResult

type fakeExecutor struct {
	results   map[string]pluginmodels.DataQueryResult
	resultsFn map[string]resultsFn
}

func (e *fakeExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource, context pluginmodels.DataQuery) (
	pluginmodels.DataResponse, error) {
	result := pluginmodels.DataResponse{Results: make(map[string]pluginmodels.DataQueryResult)}
	for _, query := range context.Queries {
		if results, has := e.results[query.RefID]; has {
			result.Results[query.RefID] = results
		}
		if testFunc, has := e.resultsFn[query.RefID]; has {
			result.Results[query.RefID] = testFunc(context)
		}
	}

	return result, nil
}

func (e *fakeExecutor) Return(refId string, series pluginmodels.DataTimeSeriesSlice) {
	e.results[refId] = pluginmodels.DataQueryResult{
		RefID: refId, Series: series,
	}
}

func (e *fakeExecutor) HandleQuery(refId string, fn resultsFn) {
	e.resultsFn[refId] = fn
}

type fakeBackendPM struct {
	backendmodels.Manager
}

func (pm fakeBackendPM) GetDataPlugin(string) interface{} {
	return nil
}

func createService() (Service, *fakeExecutor) {
	s := NewService()
	s.PluginManager = &plugins.PluginManager{
		BackendPluginManager: fakeBackendPM{},
	}
	e := &fakeExecutor{
		results:   make(map[string]pluginmodels.DataQueryResult),
		resultsFn: make(map[string]resultsFn),
	}
	s.registry["test"] = func(*models.DataSource) (pluginmodels.DataPlugin, error) {
		return e, nil
	}

	return s, e
}

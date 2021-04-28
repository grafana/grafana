package tsdb

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/stretchr/testify/require"
)

func TestHandleRequest(t *testing.T) {
	t.Run("Should return query result when handling request for query", func(t *testing.T) {
		req := plugins.DataQuery{
			Queries: []plugins.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		svc, exe := createService()
		exe.Return("A", plugins.DataTimeSeriesSlice{plugins.DataTimeSeries{Name: "argh"}})

		res, err := svc.HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		require.NoError(t, err)
		require.NotEmpty(t, res.Results["A"].Series)
		require.Equal(t, "argh", res.Results["A"].Series[0].Name)
	})

	t.Run("Should return query results when handling request for two queries with same data source", func(t *testing.T) {
		req := plugins.DataQuery{
			Queries: []plugins.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
				{RefID: "B", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		svc, exe := createService()
		exe.Return("A", plugins.DataTimeSeriesSlice{plugins.DataTimeSeries{Name: "argh"}})
		exe.Return("B", plugins.DataTimeSeriesSlice{plugins.DataTimeSeries{Name: "barg"}})

		res, err := svc.HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		require.NoError(t, err)

		require.Len(t, res.Results, 2)
		require.Equal(t, "argh", res.Results["A"].Series[0].Name)
		require.Equal(t, "barg", res.Results["B"].Series[0].Name)
	})

	t.Run("Should return error when handling request for query with unknown type", func(t *testing.T) {
		svc, _ := createService()

		req := plugins.DataQuery{
			Queries: []plugins.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "asdasdas"}},
			},
		}
		_, err := svc.HandleRequest(context.TODO(), &models.DataSource{Id: 12, Type: "testjughjgjg"}, req)
		require.Error(t, err)
	})
}

//nolint: staticcheck // plugins.DataPlugin deprecated
type resultsFn func(context plugins.DataQuery) plugins.DataQueryResult

type fakeExecutor struct {
	//nolint: staticcheck // plugins.DataPlugin deprecated
	results   map[string]plugins.DataQueryResult
	resultsFn map[string]resultsFn
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *fakeExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource, context plugins.DataQuery) (
	plugins.DataResponse, error) {
	result := plugins.DataResponse{Results: make(map[string]plugins.DataQueryResult)}
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

func (e *fakeExecutor) Return(refID string, series plugins.DataTimeSeriesSlice) {
	//nolint: staticcheck // plugins.DataPlugin deprecated
	e.results[refID] = plugins.DataQueryResult{
		RefID: refID, Series: series,
	}
}

func (e *fakeExecutor) HandleQuery(refId string, fn resultsFn) {
	e.resultsFn[refId] = fn
}

type fakeBackendPM struct {
	backendplugin.Manager
}

func (pm fakeBackendPM) GetDataPlugin(string) interface{} {
	return nil
}

func createService() (Service, *fakeExecutor) {
	s := NewService()
	s.PluginManager = &manager.PluginManager{
		BackendPluginManager: fakeBackendPM{},
	}
	e := &fakeExecutor{
		//nolint: staticcheck // plugins.DataPlugin deprecated
		results:   make(map[string]plugins.DataQueryResult),
		resultsFn: make(map[string]resultsFn),
	}
	//nolint: staticcheck // plugins.DataPlugin deprecated
	s.registry["test"] = func(*models.DataSource) (plugins.DataPlugin, error) {
		return e, nil
	}

	return s, e
}

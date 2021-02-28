package tsdb

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestHandleRequest(t *testing.T) {
	t.Run("Should return query result when handling request for query", func(t *testing.T) {
		req := &TsdbQuery{
			Queries: []*Query{
				{RefId: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		fakeExecutor := registerFakeExecutor()
		fakeExecutor.Return("A", TimeSeriesSlice{&TimeSeries{Name: "argh"}})

		res, err := HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		require.NoError(t, err)
		require.NotEmpty(t, res.Results["A"].Series)
		require.Equal(t, "argh", res.Results["A"].Series[0].Name)
	})

	t.Run("Should return query results when handling request for two queries with same data source", func(t *testing.T) {
		req := &TsdbQuery{
			Queries: []*Query{
				{RefId: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
				{RefId: "B", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		fakeExecutor := registerFakeExecutor()
		fakeExecutor.Return("A", TimeSeriesSlice{&TimeSeries{Name: "argh"}})
		fakeExecutor.Return("B", TimeSeriesSlice{&TimeSeries{Name: "barg"}})

		res, err := HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		require.NoError(t, err)

		require.Len(t, res.Results, 2)
		require.Equal(t, "argh", res.Results["A"].Series[0].Name)
		require.Equal(t, "barg", res.Results["B"].Series[0].Name)
	})

	t.Run("Should return error when handling request for query with unknown type", func(t *testing.T) {
		req := &TsdbQuery{
			Queries: []*Query{
				{RefId: "A", DataSource: &models.DataSource{Id: 1, Type: "asdasdas"}},
			},
		}

		_, err := HandleRequest(context.TODO(), &models.DataSource{Id: 12, Type: "testjughjgjg"}, req)
		require.Error(t, err)
	})
}

func registerFakeExecutor() *FakeExecutor {
	executor, _ := NewFakeExecutor(nil)
	RegisterTsdbQueryEndpoint("test", func(dsInfo *models.DataSource) (TsdbQueryEndpoint, error) {
		return executor, nil
	})

	return executor
}

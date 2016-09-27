package testdata

import (
	"math/rand"

	"github.com/grafana/grafana/pkg/tsdb"
)

type TestDataExecutor struct {
	*tsdb.DataSourceInfo
}

func NewTestDataExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &TestDataExecutor{dsInfo}
}

func init() {
	tsdb.RegisterExecutor("grafana-testdata-datasource", NewTestDataExecutor)
}

func (e *TestDataExecutor) Execute(queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}
	result.QueryResults = make(map[string]*tsdb.QueryResult)

	from, _ := context.TimeRange.FromTime()
	to, _ := context.TimeRange.ToTime()

	queryRes := &tsdb.QueryResult{}

	for _, query := range queries {
		// scenario := query.Model.Get("scenario").MustString("random_walk")
		series := &tsdb.TimeSeries{Name: "test-series-0"}

		stepInSeconds := (to.Unix() - from.Unix()) / query.MaxDataPoints
		points := make([][2]*float64, 0)
		walker := rand.Float64() * 100
		time := from.Unix()

		for i := int64(0); i < query.MaxDataPoints; i++ {
			timestamp := float64(time)
			val := float64(walker)
			points = append(points, [2]*float64{&val, &timestamp})

			walker += rand.Float64() - 0.5
			time += stepInSeconds
		}

		series.Points = points
		queryRes.Series = append(queryRes.Series, series)
	}

	result.QueryResults["A"] = queryRes
	return result
}

package tsdb

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMetricQuery(t *testing.T) {
	Convey("When executing request with one query", t, func() {
		req := &TsdbQuery{
			Queries: []*Query{
				{RefId: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}},
			},
		}

		fakeExecutor := registerFakeExecutor()
		fakeExecutor.Return("A", TimeSeriesSlice{&TimeSeries{Name: "argh"}})

		res, err := HandleRequest(context.TODO(), &models.DataSource{Id: 1, Type: "test"}, req)
		So(err, ShouldBeNil)

		Convey("Should return query results", func() {
			So(res.Results["A"].Series, ShouldNotBeEmpty)
			So(res.Results["A"].Series[0].Name, ShouldEqual, "argh")
		})
	})

	Convey("When executing one request with two queries from same data source", t, func() {
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
		So(err, ShouldBeNil)

		Convey("Should return query results", func() {
			So(len(res.Results), ShouldEqual, 2)
			So(res.Results["B"].Series[0].Name, ShouldEqual, "barg")
		})
	})

	Convey("When query uses data source of unknown type", t, func() {
		req := &TsdbQuery{
			Queries: []*Query{
				{RefId: "A", DataSource: &models.DataSource{Id: 1, Type: "asdasdas"}},
			},
		}

		_, err := HandleRequest(context.TODO(), &models.DataSource{Id: 12, Type: "testjughjgjg"}, req)
		So(err, ShouldNotBeNil)
	})
}

func registerFakeExecutor() *FakeExecutor {
	executor, _ := NewFakeExecutor(nil)
	RegisterTsdbQueryEndpoint("test", func(dsInfo *models.DataSource) (TsdbQueryEndpoint, error) {
		return executor, nil
	})

	return executor
}

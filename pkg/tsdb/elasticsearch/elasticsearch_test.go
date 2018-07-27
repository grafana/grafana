package elasticsearch

import (
	// "testing"

	"github.com/grafana/grafana/pkg/tsdb"
	// . "github.com/smartystreets/goconvey/convey"
)

// func TestElasticsearch(t *testing.T) {
// Convey("Elasticsearch query executor test", t, func() {
// 	ds := models.DataSource{}
// 	esQueryExecutor, err := NewElasticsearchExecutor(&ds)
// 	So(err, ShouldBeNil)

// 	origNewClient := es.NewClient
// 	es.NewClient = func(ctx context.Context, ds *models.DataSource, timeRange *tsdb.TimeRange) (es.Client, error) {
//  	return newFakeClient(2), nil
// 	}

// 	timeSeriesQueryCreated := false
// 	origNewTimeSeriesQuery := newTimeSeriesQuery
// 	newTimeSeriesQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery, intervalCalculator tsdb.IntervalCalculator) queryEndpoint {
// 		timeSeriesQueryCreated = true
// 		return &fakeQueryEndpoint{}
// 	}

// 	getFieldsQueryCreated := false
// 	origNewFieldsQuery := newFieldsQuery
// 	newFieldsQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery) queryEndpoint {
// 		getFieldsQueryCreated = true
// 		return &fakeQueryEndpoint{}
// 	}

// 	getTermsQueryCreated := false
// 	origNewTermsQuery := newTermsQuery
// 	newTermsQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery) queryEndpoint {
// 		getTermsQueryCreated = true
// 		return &fakeQueryEndpoint{}
// 	}

// 	Convey("Should return error for empty query", func() {
// 		_, err = esQueryExecutor.Query(context.TODO(), &ds, &tsdb.TsdbQuery{})
// 		So(err, ShouldNotBeNil)
// 		So(err.Error(), ShouldEqual, "query contains no queries")
// 	})

// 	Convey("Should fallback to time series query", func() {
// 		_, err = esQueryExecutor.Query(context.TODO(), &ds, &tsdb.TsdbQuery{
// 			Queries: []*tsdb.Query{
// 				{
// 					Model: simplejson.New(),
// 				},
// 			},
// 		})
// 		So(err, ShouldBeNil)
// 		So(timeSeriesQueryCreated, ShouldBeTrue)
// 	})

// 	Convey("Should handle get fields query", func() {
// 		_, err = esQueryExecutor.Query(context.TODO(), &ds, &tsdb.TsdbQuery{
// 			Queries: []*tsdb.Query{
// 				{
// 					Model: simplejson.NewFromAny(map[string]interface{}{
// 						"queryType": "fields",
// 					}),
// 				},
// 			},
// 		})
// 		So(err, ShouldBeNil)
// 		So(getFieldsQueryCreated, ShouldBeTrue)
// 	})

// 	Convey("Should handle get terms query", func() {
// 		_, err = esQueryExecutor.Query(context.TODO(), &ds, &tsdb.TsdbQuery{
// 			Queries: []*tsdb.Query{
// 				{
// 					Model: simplejson.NewFromAny(map[string]interface{}{
// 						"queryType": "terms",
// 					}),
// 				},
// 			},
// 		})
// 		So(err, ShouldBeNil)
// 		So(getTermsQueryCreated, ShouldBeTrue)
// 	})

// 	Reset(func() {
// 		es.NewClient = origNewClient
// 		newTimeSeriesQuery = origNewTimeSeriesQuery
// 		newFieldsQuery = origNewFieldsQuery
// 		newTermsQuery = origNewTermsQuery
// 	})
// })
// }

type fakeQueryEndpoint struct{}

func (e *fakeQueryEndpoint) execute() (*tsdb.Response, error) {
	return nil, nil
}

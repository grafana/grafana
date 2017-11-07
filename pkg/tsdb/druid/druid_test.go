package druid

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
	"sync"
	"time"
)

func TestDruidExecutor(t *testing.T) {
	Convey("Druid query testing", t, func() {

		exec := &DruidExecutor{}
		tr := &tsdb.TimeRange{"2017-09-03T17:13:01-07:00", "2017-10-03T17:13:01-07:00", time.Now()}

		queries := new(tsdb.QuerySlice)
		results := make(map[string]*tsdb.QueryResult)
		resultsChan := make(chan *tsdb.BatchResult)
		lock := new(sync.RWMutex)
		batchWaits := new(sync.WaitGroup)

		Convey("Given a timeseries query", func() {
			queryContext := &tsdb.QueryContext{
				tr,
				*queries,
				results,
				resultsChan,
				*lock,
				*batchWaits,
			}

			query := &tsdb.Query{
				Model: simplejson.New(),
			}

			query.Model.Set("druidDS", "metrics-ds")
			query.Model.Set("queryType", "timeseries")
			query.Model.Set("customGranularity", "second")
			query.Model.Set("descending", true)
			query.Model.Set("druidMetric", "test-metric")
			query.Model.Set("selectThreshold", 5)

			exec.QueryParser.ParseQuery(query.Model, queryContext)

			So(query.Model.Get("dataSource").MustString(), ShouldEqual, "metrics-ds")
			So(query.Model.Get("queryType").MustString(), ShouldEqual, "timeseries")
			So(query.Model.Get("granularity").MustString(), ShouldEqual, "second")
			So(query.Model.Get("descending").MustBool(), ShouldEqual, true)
			So(query.Model.Get("metric").MustString(), ShouldEqual, "test-metric")
			So(query.Model.Get("threshold").MustInt(), ShouldEqual, 5)
		})

		Convey("Given iso-8601 format time string", func() {
			ts := "2017-10-02T06:59:00.000Z"

			seconds, err := exec.ResponseParser.convertRFC3339ToSeconds(ts)

			So(err, ShouldEqual, nil)
			So(seconds, ShouldEqual, 1.50692754e+09)
		})

		Convey("Given mal-formatted time string", func() {
			ts := "20174-13-80T06:59:00.000Z"

			_, err := exec.ResponseParser.convertRFC3339ToSeconds(ts)

			So(err, ShouldNotBeNil)
		})
	})

}

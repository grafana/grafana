package mqe

import (
	"testing"

	"time"

	"fmt"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWildcardExpansion(t *testing.T) {
	availableMetrics := []string{
		"os.cpu.all.idle",
		"os.cpu.1.idle",
		"os.cpu.2.idle",
		"os.cpu.3.idle",
	}

	now := time.Now()
	from := now.Add((time.Minute*5)*-1).UnixNano() / int64(time.Millisecond)
	to := now.UnixNano() / int64(time.Millisecond)

	Convey("Can expanding query", t, func() {
		Convey("Without wildcard series", func() {
			query := &Query{
				Metrics: []Metric{
					{Metric: "os.cpu.3.idle", Alias: ""},
					{Metric: "os.cpu.2.idle", Alias: ""},
					{Metric: "os.cpu.1.idle", Alias: "cpu"},
				},
				Hosts:             []string{"staples-lab-1", "staples-lab-2"},
				Cluster:           []string{"demoapp-1", "demoapp-2"},
				AddClusterToAlias: false,
				AddHostToAlias:    false,
				FunctionList: []Function{
					{Func: "aggregate.min"},
				},
				TimeRange: &tsdb.TimeRange{Now: now, From: "5m", To: "now"},
			}

			expandeQueries, err := query.Build(availableMetrics)
			So(err, ShouldBeNil)
			So(len(expandeQueries), ShouldEqual, 3)
			So(expandeQueries[0].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.3.idle`|aggregate.min where cluster in ('demoapp-1', 'demoapp-2') and host in ('staples-lab-1', 'staples-lab-2') from %v to %v", from, to))
			So(expandeQueries[1].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.2.idle`|aggregate.min where cluster in ('demoapp-1', 'demoapp-2') and host in ('staples-lab-1', 'staples-lab-2') from %v to %v", from, to))
			So(expandeQueries[2].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.1.idle`|aggregate.min {cpu} where cluster in ('demoapp-1', 'demoapp-2') and host in ('staples-lab-1', 'staples-lab-2') from %v to %v", from, to))
		})

		Convey("With two aggregate functions", func() {
			query := &Query{
				Metrics: []Metric{
					{Metric: "os.cpu.3.idle", Alias: ""},
				},
				Hosts:             []string{"staples-lab-1", "staples-lab-2"},
				Cluster:           []string{"demoapp-1", "demoapp-2"},
				AddClusterToAlias: false,
				AddHostToAlias:    false,
				FunctionList: []Function{
					{Func: "aggregate.min"},
					{Func: "aggregate.max"},
				},
				TimeRange: &tsdb.TimeRange{Now: now, From: "5m", To: "now"},
			}

			expandeQueries, err := query.Build(availableMetrics)
			So(err, ShouldBeNil)
			So(len(expandeQueries), ShouldEqual, 1)
			So(expandeQueries[0].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.3.idle`|aggregate.min|aggregate.max where cluster in ('demoapp-1', 'demoapp-2') and host in ('staples-lab-1', 'staples-lab-2') from %v to %v", from, to))
		})

		Convey("Containing wildcard series", func() {
			query := &Query{
				Metrics: []Metric{
					{Metric: "os.cpu*", Alias: ""},
				},
				Hosts:             []string{"staples-lab-1"},
				AddClusterToAlias: false,
				AddHostToAlias:    false,
				TimeRange:         &tsdb.TimeRange{Now: now, From: "5m", To: "now"},
			}

			expandeQueries, err := query.Build(availableMetrics)
			So(err, ShouldBeNil)
			So(len(expandeQueries), ShouldEqual, 4)

			So(expandeQueries[0].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.all.idle` where host in ('staples-lab-1') from %v to %v", from, to))
			So(expandeQueries[1].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.1.idle` where host in ('staples-lab-1') from %v to %v", from, to))
			So(expandeQueries[2].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.2.idle` where host in ('staples-lab-1') from %v to %v", from, to))
			So(expandeQueries[3].RawQuery, ShouldEqual, fmt.Sprintf("`os.cpu.3.idle` where host in ('staples-lab-1') from %v to %v", from, to))
		})
	})
}

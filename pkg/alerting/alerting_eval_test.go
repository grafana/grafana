package alerting

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"bosun.org/graphite"
	"github.com/grafana/grafana/pkg/metric/helper"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

type fakeGraphite struct {
	resp    graphite.Response
	queries chan *graphite.Request
}

func init() {
	backend, _ := helper.New(false, "", "standard", "")
	Init(backend)
}

func (fg fakeGraphite) Query(req *graphite.Request) (graphite.Response, error) {
	if fg.queries != nil {
		fg.queries <- req
	}
	return fg.resp, nil
}

func NewFakeGraphite(values [][]int, initialTs int64, step int) *fakeGraphite {
	fg := &fakeGraphite{}
	series := make([]graphite.Series, 0)
	for serieNum, pointSlice := range values {
		serie := graphite.Series{
			Target: fmt.Sprintf("test.serie.%d", serieNum),
		}
		for i, point := range pointSlice {
			v := json.Number(fmt.Sprintf("%d", point))
			ts := json.Number(fmt.Sprintf("%d", int(initialTs)+i*step))
			pt := graphite.DataPoint{}
			pt = append(pt, v, ts)
			serie.Datapoints = append(serie.Datapoints, pt)
		}
		series = append(series, serie)
	}

	fg.resp = graphite.Response(series)
	return fg
}

func check(expr string, warn, crit int, values [][]int, expectErr error, expectRes m.CheckEvalResult) {
	checkDef := CheckDef{}
	if warn != -1 {
		checkDef.WarnExpr = fmt.Sprintf(expr, `graphite("test", "2m", "", "")`, warn)
	}
	if crit != -1 {
		checkDef.CritExpr = fmt.Sprintf(expr, `graphite("test", "2m", "", "")`, crit)
	}
	now := time.Now()
	end := now.Unix()
	step := 10
	steps := 0
	for _, serie := range values {
		if len(serie) > steps {
			steps = len(serie)
		}
	}
	fmt.Printf("vals %v - end %d, steps %d\n", values, end, steps)
	fg := NewFakeGraphite(values, end-int64((steps-1)*step), steps)
	evaluator, err := NewGraphiteCheckEvaluator(fg, checkDef)
	So(err, ShouldBeNil)

	res, err := evaluator.Eval(now)
	So(err, ShouldEqual, expectErr)
	So(res, ShouldEqual, expectRes)
}

func TestAlertingMinimal(t *testing.T) {

	Convey("check result on 1 series with 1 point should match expected outcome", t, func() {
		check(`median(%s) > %d`, -1, 100, [][]int{{150}}, nil, m.EvalResultCrit)
		check(`median(%s) > %d`, -1, 100, [][]int{{100}}, nil, m.EvalResultOK)
		check(`median(%s) > %d`, -1, 100, [][]int{{70}}, nil, m.EvalResultOK)
		check(`median(%s) < %d`, 150, 100, [][]int{{70}}, nil, m.EvalResultCrit)
		check(`median(%s) < %d`, 150, 100, [][]int{{100}}, nil, m.EvalResultWarn)
		check(`median(%s) < %d`, 150, 100, [][]int{{150}}, nil, m.EvalResultOK)
		check(`median(%s) < %d`, 150, 100, [][]int{{200}}, nil, m.EvalResultOK)
	})

	Convey("check result on 1 series with 3 points should match expected outcome", t, func() {
		check(`median(%s) > %d`, -1, 100, [][]int{{50, 150, 200}}, nil, m.EvalResultCrit)
		check(`median(%s) > %d`, -1, 100, [][]int{{50, 100, 150}}, nil, m.EvalResultOK)
		check(`median(%s) > %d`, -1, 100, [][]int{{20, 70, 120}}, nil, m.EvalResultOK)
		check(`median(%s) < %d`, 150, 100, [][]int{{20, 70, 120}}, nil, m.EvalResultCrit)
		check(`median(%s) < %d`, 150, 100, [][]int{{50, 100, 150}}, nil, m.EvalResultWarn)
		check(`median(%s) < %d`, 150, 100, [][]int{{100, 150, 200}}, nil, m.EvalResultOK)
		check(`median(%s) < %d`, 150, 100, [][]int{{150, 200, 250}}, nil, m.EvalResultOK)
	})

	Convey("check result on 3 series with 1 point each should match the worst series", t, func() {
		check(`median(%s) > %d`, -1, 100, [][]int{{50}, {150}, {200}}, nil, m.EvalResultCrit)
		check(`median(%s) > %d`, -1, 100, [][]int{{50}, {100}, {150}}, nil, m.EvalResultCrit)
		check(`median(%s) > %d`, -1, 100, [][]int{{20}, {70}, {120}}, nil, m.EvalResultCrit)
		check(`median(%s) > %d`, -1, 100, [][]int{{10}, {50}, {100}}, nil, m.EvalResultOK)
		check(`median(%s) > %d`, -1, 100, [][]int{{10}, {10}, {80}}, nil, m.EvalResultOK)
		check(`median(%s) > %d`, -1, 100, [][]int{{10}, {10}, {60}}, nil, m.EvalResultOK)
		check(`median(%s) > %d`, -1, 100, [][]int{{10}, {101}, {50}}, nil, m.EvalResultCrit)
		check(`median(%s) < %d`, 150, 100, [][]int{{20}, {70}, {120}}, nil, m.EvalResultCrit)
		check(`median(%s) < %d`, 150, 100, [][]int{{50}, {100}, {150}}, nil, m.EvalResultCrit)
		check(`median(%s) < %d`, 150, 100, [][]int{{100}, {150}, {200}}, nil, m.EvalResultWarn)
		check(`median(%s) < %d`, 150, 100, [][]int{{150}, {200}, {250}}, nil, m.EvalResultOK)
	})
}

package alerting

import (
	"fmt"
	"testing"
	"time"

	"bosun.org/graphite"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/hashicorp/golang-lru"
	. "github.com/smartystreets/goconvey/convey"
)

func assertReq(t *testing.T, listener chan *graphite.Request, msg string) {
	select {
	case <-listener:
		return
	default:
		t.Fatal(msg)
	}
}
func assertEmpty(t *testing.T, listener chan *graphite.Request, msg string) {
	select {
	case <-listener:
		t.Fatal(msg)
	default:
		return
	}
}

func TestExecutor(t *testing.T) {
	listener := make(chan *graphite.Request, 100)
	Convey("executor must do the right thing", t, func() {

		fakeGraphiteReturner := func(org_id int64) graphite.Context {
			return fakeGraphite{
				resp: graphite.Response(
					make([]graphite.Series, 0),
				),
				queries: listener,
			}
		}
		jobAt := func(ts int64) Job {
			return Job{
				State: m.EvalResultUnknown,
				Definition: CheckDef{
					CritExpr: `graphite("foo", "2m", "", "")`,
					WarnExpr: "0",
				},
				LastPointTs: time.Unix(ts, 0),
			}
		}
		jobQueue := make(chan Job, 10)
		cache, err := lru.New(1000)
		if err != nil {
			panic(fmt.Sprintf("Can't create LRU: %s", err.Error()))
		}
		go Executor(fakeGraphiteReturner, jobQueue, cache)
		jobQueue <- jobAt(0)
		jobQueue <- jobAt(1)
		jobQueue <- jobAt(2)
		jobQueue <- jobAt(2)
		jobQueue <- jobAt(1)
		jobQueue <- jobAt(0)
		time.Sleep(1000 * time.Millisecond) // yes hacky, can be synchronized later
		assertReq(t, listener, "expected the first job")
		assertReq(t, listener, "expected the second job")
		assertReq(t, listener, "expected the third job")
		assertEmpty(t, listener, "expected to be done after three jobs, with duplicates and old jobs ignored")
	})
}

package schedule

import (
	context "context"
	"math"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
)

func TestAlertRuleInfo(t *testing.T) {
	type evalResponse struct {
		success     bool
		droppedEval *evaluation
	}

	t.Run("when rule evaluation is not stopped", func(t *testing.T) {
		t.Run("update should send to updateCh", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			resultCh := make(chan bool)
			go func() {
				resultCh <- r.update(ruleVersionAndPauseStatus{fingerprint(rand.Uint64()), false})
			}()
			select {
			case <-r.updateCh:
				require.True(t, <-resultCh)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on update channel")
			}
		})
		t.Run("update should drop any concurrent sending to updateCh", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			version1 := ruleVersionAndPauseStatus{fingerprint(rand.Uint64()), false}
			version2 := ruleVersionAndPauseStatus{fingerprint(rand.Uint64()), false}

			wg := sync.WaitGroup{}
			wg.Add(1)
			go func() {
				wg.Done()
				r.update(version1)
				wg.Done()
			}()
			wg.Wait()
			wg.Add(2) // one when time1 is sent, another when go-routine for time2 has started
			go func() {
				wg.Done()
				r.update(version2)
			}()
			wg.Wait() // at this point tick 1 has already been dropped
			select {
			case version := <-r.updateCh:
				require.Equal(t, version2, version)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("eval should send to evalCh", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			expected := time.Now()
			resultCh := make(chan evalResponse)
			data := &evaluation{
				scheduledAt: expected,
				rule:        models.AlertRuleGen()(),
				folderTitle: util.GenerateShortUID(),
			}
			go func() {
				result, dropped := r.eval(data)
				resultCh <- evalResponse{result, dropped}
			}()
			select {
			case ctx := <-r.evalCh:
				require.Equal(t, data, ctx)
				result := <-resultCh
				require.True(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("eval should drop any concurrent sending to evalCh", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			time1 := time.UnixMilli(rand.Int63n(math.MaxInt64))
			time2 := time.UnixMilli(rand.Int63n(math.MaxInt64))
			resultCh1 := make(chan evalResponse)
			resultCh2 := make(chan evalResponse)
			data := &evaluation{
				scheduledAt: time1,
				rule:        models.AlertRuleGen()(),
				folderTitle: util.GenerateShortUID(),
			}
			data2 := &evaluation{
				scheduledAt: time2,
				rule:        data.rule,
				folderTitle: data.folderTitle,
			}
			wg := sync.WaitGroup{}
			wg.Add(1)
			go func() {
				wg.Done()
				result, dropped := r.eval(data)
				wg.Done()
				resultCh1 <- evalResponse{result, dropped}
			}()
			wg.Wait()
			wg.Add(2) // one when time1 is sent, another when go-routine for time2 has started
			go func() {
				wg.Done()
				result, dropped := r.eval(data2)
				resultCh2 <- evalResponse{result, dropped}
			}()
			wg.Wait() // at this point tick 1 has already been dropped
			select {
			case ctx := <-r.evalCh:
				require.Equal(t, time2, ctx.scheduledAt)
				result := <-resultCh1
				require.True(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
				result = <-resultCh2
				require.True(t, result.success)
				require.NotNil(t, result.droppedEval, "expected no dropped evaluations but got one")
				require.Equal(t, time1, result.droppedEval.scheduledAt)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("eval should exit when context is cancelled", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			resultCh := make(chan evalResponse)
			data := &evaluation{
				scheduledAt: time.Now(),
				rule:        models.AlertRuleGen()(),
				folderTitle: util.GenerateShortUID(),
			}
			go func() {
				result, dropped := r.eval(data)
				resultCh <- evalResponse{result, dropped}
			}()
			runtime.Gosched()
			r.stop(nil)
			select {
			case result := <-resultCh:
				require.False(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
	})
	t.Run("when rule evaluation is stopped", func(t *testing.T) {
		t.Run("Update should do nothing", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			r.stop(errRuleDeleted)
			require.ErrorIs(t, r.ctx.Err(), errRuleDeleted)
			require.False(t, r.update(ruleVersionAndPauseStatus{fingerprint(rand.Uint64()), false}))
		})
		t.Run("eval should do nothing", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			r.stop(nil)
			data := &evaluation{
				scheduledAt: time.Now(),
				rule:        models.AlertRuleGen()(),
				folderTitle: util.GenerateShortUID(),
			}
			success, dropped := r.eval(data)
			require.False(t, success)
			require.Nilf(t, dropped, "expected no dropped evaluations but got one")
		})
		t.Run("stop should do nothing", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			r.stop(nil)
			r.stop(nil)
		})
		t.Run("stop should do nothing if parent context stopped", func(t *testing.T) {
			ctx, cancelFn := context.WithCancel(context.Background())
			r := newAlertRuleInfo(ctx)
			cancelFn()
			r.stop(nil)
		})
	})
	t.Run("should be thread-safe", func(t *testing.T) {
		r := newAlertRuleInfo(context.Background())
		wg := sync.WaitGroup{}
		go func() {
			for {
				select {
				case <-r.evalCh:
					time.Sleep(time.Microsecond)
				case <-r.updateCh:
					time.Sleep(time.Microsecond)
				case <-r.ctx.Done():
					return
				}
			}
		}()

		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				for i := 0; i < 20; i++ {
					max := 3
					if i <= 10 {
						max = 2
					}
					switch rand.Intn(max) + 1 {
					case 1:
						r.update(ruleVersionAndPauseStatus{fingerprint(rand.Uint64()), false})
					case 2:
						r.eval(&evaluation{
							scheduledAt: time.Now(),
							rule:        models.AlertRuleGen()(),
							folderTitle: util.GenerateShortUID(),
						})
					case 3:
						r.stop(nil)
					}
				}
				wg.Done()
			}()
		}

		wg.Wait()
	})
}

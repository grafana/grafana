package schedule

import (
	"context"
	"math"
	"math/rand"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestSchedule_alertRuleInfo(t *testing.T) {
	type evalResponse struct {
		success     bool
		droppedEval *evaluation
	}

	t.Run("when rule evaluation is not stopped", func(t *testing.T) {
		t.Run("update should send to updateCh", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			resultCh := make(chan bool)
			go func() {
				resultCh <- r.update(ruleVersionAndPauseStatus{ruleVersion(rand.Int63()), false})
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
			version1 := ruleVersion(rand.Int31())
			version2 := version1 + 1

			wg := sync.WaitGroup{}
			wg.Add(1)
			go func() {
				wg.Done()
				r.update(ruleVersionAndPauseStatus{version1, false})
				wg.Done()
			}()
			wg.Wait()
			wg.Add(2) // one when time1 is sent, another when go-routine for time2 has started
			go func() {
				wg.Done()
				r.update(ruleVersionAndPauseStatus{version2, false})
			}()
			wg.Wait() // at this point tick 1 has already been dropped
			select {
			case version := <-r.updateCh:
				require.Equal(t, ruleVersionAndPauseStatus{version2, false}, version)
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
		t.Run("update should drop any concurrent sending to updateCh and use greater version", func(t *testing.T) {
			r := newAlertRuleInfo(context.Background())
			version1 := ruleVersion(rand.Int31())
			version2 := version1 + 1

			wg := sync.WaitGroup{}
			wg.Add(1)
			go func() {
				wg.Done()
				r.update(ruleVersionAndPauseStatus{version2, false})
				wg.Done()
			}()
			wg.Wait()
			wg.Add(2) // one when time1 is sent, another when go-routine for time2 has started
			go func() {
				wg.Done()
				r.update(ruleVersionAndPauseStatus{version1, false})
			}()
			wg.Wait() // at this point tick 1 has already been dropped
			select {
			case version := <-r.updateCh:
				require.Equal(t, ruleVersionAndPauseStatus{version2, false}, version)
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
			require.False(t, r.update(ruleVersionAndPauseStatus{ruleVersion(rand.Int63()), false}))
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
						r.update(ruleVersionAndPauseStatus{ruleVersion(rand.Int63()), false})
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

func TestSchedulableAlertRulesRegistry(t *testing.T) {
	r := alertRulesRegistry{rules: make(map[models.AlertRuleKey]*models.AlertRule)}
	rules, folders := r.all()
	assert.Len(t, rules, 0)
	assert.Len(t, folders, 0)

	expectedFolders := map[string]string{"test-uid": "test-title"}
	// replace all rules in the registry with foo
	r.set([]*models.AlertRule{{OrgID: 1, UID: "foo", Version: 1}}, expectedFolders)
	rules, folders = r.all()
	assert.Len(t, rules, 1)
	assert.Equal(t, expectedFolders, folders)

	foo := r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "foo", Version: 1}, *foo)

	// update foo to a newer version
	r.update(&models.AlertRule{OrgID: 1, UID: "foo", Version: 2})
	rules, _ = r.all()
	assert.Len(t, rules, 1)
	foo = r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "foo", Version: 2}, *foo)

	// update bar which does not exist in the registry
	r.update(&models.AlertRule{OrgID: 1, UID: "bar", Version: 1})
	rules, _ = r.all()
	assert.Len(t, rules, 2)
	foo = r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "foo", Version: 2}, *foo)
	bar := r.get(models.AlertRuleKey{OrgID: 1, UID: "bar"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "bar", Version: 1}, *bar)

	// replace all rules in the registry with baz
	r.set([]*models.AlertRule{{OrgID: 1, UID: "baz", Version: 1}}, nil)
	rules, folders = r.all()
	assert.Len(t, rules, 1)
	assert.Nil(t, folders)
	baz := r.get(models.AlertRuleKey{OrgID: 1, UID: "baz"})
	require.NotNil(t, baz)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "baz", Version: 1}, *baz)
	assert.Nil(t, r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"}))
	assert.Nil(t, r.get(models.AlertRuleKey{OrgID: 1, UID: "bar"}))

	// delete baz
	deleted, ok := r.del(models.AlertRuleKey{OrgID: 1, UID: "baz"})
	assert.True(t, ok)
	require.NotNil(t, deleted)
	assert.Equal(t, *deleted, *baz)
	rules, folders = r.all()
	assert.Len(t, rules, 0)
	assert.Len(t, folders, 0)
	assert.Nil(t, r.get(models.AlertRuleKey{OrgID: 1, UID: "baz"}))

	// baz cannot be deleted twice
	deleted, ok = r.del(models.AlertRuleKey{OrgID: 1, UID: "baz"})
	assert.False(t, ok)
	assert.Nil(t, deleted)
}

package schedule

import (
	"context"
	"encoding/json"
	"math"
	"math/rand"
	"reflect"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
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

func TestSchedulableAlertRulesRegistry_set(t *testing.T) {
	_, initialRules := models.GenerateUniqueAlertRules(100, models.AlertRuleGen())
	init := make(map[models.AlertRuleKey]*models.AlertRule, len(initialRules))
	for _, rule := range initialRules {
		init[rule.GetKey()] = rule
	}
	r := alertRulesRegistry{rules: init}
	t.Run("should return empty diff if exactly the same rules", func(t *testing.T) {
		newRules := make([]*models.AlertRule, 0, len(initialRules))
		for _, rule := range initialRules {
			newRules = append(newRules, models.CopyRule(rule))
		}
		diff := r.set(newRules, map[string]string{})
		require.Truef(t, diff.IsEmpty(), "Diff is not empty. Probably we check something else than key + version")
	})
	t.Run("should return empty diff if version does not change", func(t *testing.T) {
		newRules := make([]*models.AlertRule, 0, len(initialRules))
		// generate random and then override rule key + version
		_, randomNew := models.GenerateUniqueAlertRules(len(initialRules), models.AlertRuleGen())
		for i := 0; i < len(initialRules); i++ {
			rule := randomNew[i]
			oldRule := initialRules[i]
			rule.UID = oldRule.UID
			rule.OrgID = oldRule.OrgID
			rule.Version = oldRule.Version
			newRules = append(newRules, rule)
		}

		diff := r.set(newRules, map[string]string{})
		require.Truef(t, diff.IsEmpty(), "Diff is not empty. Probably we check something else than key + version")
	})
	t.Run("should return key in diff if version changes", func(t *testing.T) {
		newRules := make([]*models.AlertRule, 0, len(initialRules))
		expectedUpdated := map[models.AlertRuleKey]struct{}{}
		for i, rule := range initialRules {
			cp := models.CopyRule(rule)
			if i%2 == 0 {
				cp.Version++
				expectedUpdated[cp.GetKey()] = struct{}{}
			}
			newRules = append(newRules, cp)
		}
		require.NotEmptyf(t, expectedUpdated, "Input parameters have changed. Nothing to assert")

		diff := r.set(newRules, map[string]string{})
		require.Falsef(t, diff.IsEmpty(), "Diff is empty but should not be")
		require.Equal(t, expectedUpdated, diff.updated)
	})
}

func TestRuleWithFolderFingerprint(t *testing.T) {
	rule := models.AlertRuleGen()()
	title := uuid.NewString()
	f := ruleWithFolder{rule: rule, folderTitle: title}.Fingerprint()
	t.Run("should calculate a fingerprint", func(t *testing.T) {
		require.NotEqual(t, 0, uint64(f))
	})
	t.Run("mirror copy should have the same fingerprint", func(t *testing.T) {
		f2 := ruleWithFolder{rule: models.CopyRule(rule), folderTitle: title}.Fingerprint()
		require.Equal(t, f, f2)
	})
	t.Run("order of queries should not affect the fingerprint", func(t *testing.T) {
		cp := models.CopyRule(rule)
		rand.Shuffle(len(cp.Data), func(i, j int) {
			cp.Data[i], cp.Data[j] = cp.Data[j], cp.Data[i]
		})
		f2 := ruleWithFolder{rule: cp, folderTitle: title}.Fingerprint()
		require.Equal(t, f, f2)
	})
	t.Run("folder name should be used in fingerprint", func(t *testing.T) {
		f2 := ruleWithFolder{rule: rule, folderTitle: uuid.NewString()}.Fingerprint()
		require.NotEqual(t, f, f2)
	})
	t.Run("Version and Updated should be excluded from fingerprint", func(t *testing.T) {
		cp := models.CopyRule(rule)
		cp.Version++
		cp.Updated = cp.Updated.Add(1 * time.Second)

		f2 := ruleWithFolder{rule: cp, folderTitle: title}.Fingerprint()
		require.Equal(t, f, f2)
	})

	t.Run("all other fields should be considered", func(t *testing.T) {
		r1 := &models.AlertRule{
			ID:        1,
			OrgID:     2,
			Title:     "test",
			Condition: "A",
			Data: []models.AlertQuery{
				{
					RefID:     "1",
					QueryType: "323",
					RelativeTimeRange: models.RelativeTimeRange{
						From: 1,
						To:   2,
					},
					DatasourceUID: "123",
					Model:         json.RawMessage(`{"test": "test-model"}`),
				},
			},
			Updated:         time.Now(),
			IntervalSeconds: 2,
			Version:         1,
			UID:             "test-uid",
			NamespaceUID:    "test-ns",
			DashboardUID:    func(s string) *string { return &s }("dashboard"),
			PanelID:         func(i int64) *int64 { return &i }(123),
			RuleGroup:       "test-group",
			RuleGroupIndex:  1,
			NoDataState:     "test-nodata",
			ExecErrState:    "test-err",
			For:             12,
			Annotations: map[string]string{
				"key-annotation": "value-annotation",
			},
			Labels: map[string]string{
				"key-label": "value-label",
			},
			IsPaused: false,
		}
		r2 := &models.AlertRule{
			ID:        2,
			OrgID:     3,
			Title:     "test-2",
			Condition: "B",
			Data: []models.AlertQuery{
				{
					RefID:     "2",
					QueryType: "12313123",
					RelativeTimeRange: models.RelativeTimeRange{
						From: 2,
						To:   3,
					},
					DatasourceUID: "asdasdasd21",
					Model:         json.RawMessage(`{"test": "test-model-2"}`),
				},
			},
			IntervalSeconds: 23,
			UID:             "test-uid2",
			NamespaceUID:    "test-ns2",
			DashboardUID:    func(s string) *string { return &s }("dashboard-2"),
			PanelID:         func(i int64) *int64 { return &i }(1222),
			RuleGroup:       "test-group-2",
			RuleGroupIndex:  22,
			NoDataState:     "test-nodata2",
			ExecErrState:    "test-err2",
			For:             1141,
			Annotations: map[string]string{
				"key-annotation2": "value-annotation",
			},
			Labels: map[string]string{
				"key-label": "value-label23",
			},
			IsPaused: true,
		}

		excludedFields := map[string]struct{}{
			"Version": {},
			"Updated": {},
		}

		tp := reflect.TypeOf(rule).Elem()
		var nonDiffFields []string
		// making sure that we get completely different struct

		dif := r1.Diff(r2)
		nonDiffFields = make([]string, 0)
		for j := 0; j < tp.NumField(); j++ {
			name := tp.Field(j).Name
			if _, ok := excludedFields[name]; ok {
				continue
			}
			if len(dif.GetDiffsForField(tp.Field(j).Name)) == 0 {
				nonDiffFields = append(nonDiffFields, tp.Field(j).Name)
			}
		}
		require.Emptyf(t, nonDiffFields, "cannot generate completely unique alert rule. Some fields are not randomized")

		r2v := reflect.ValueOf(r2).Elem()
		for i := 0; i < tp.NumField(); i++ {
			if _, ok := excludedFields[tp.Field(i).Name]; ok {
				continue
			}
			cp := models.CopyRule(r1)
			v := reflect.ValueOf(cp).Elem()
			vf := v.Field(i)
			vf.Set(r2v.Field(i))
			f2 := ruleWithFolder{rule: cp, folderTitle: title}.Fingerprint()
			if f2 == f {
				t.Fatalf("Field %s does not seem to be used in fingerprint. Diff: %s", tp.Field(i).Name, r1.Diff(cp))
			}
		}
	})
}

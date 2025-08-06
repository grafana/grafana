package schedule

import (
	"bytes"
	context "context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"go.uber.org/atomic"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestRecordingRule(t *testing.T) {
	gen := models.RuleGen.With(models.RuleGen.WithAllRecordingRules())
	// evalRetval carries the return value of Rule.Eval() calls.
	type evalRetval struct {
		success     bool
		droppedEval *Evaluation
	}

	t.Run("when rule evaluation is not stopped", func(t *testing.T) {
		t.Run("eval should send to evalCh", func(t *testing.T) {
			r := blankRecordingRuleForTests(context.Background())
			expected := time.Now()
			resultCh := make(chan evalRetval)
			data := &Evaluation{
				scheduledAt: expected,
				rule:        gen.GenerateRef(),
				folderTitle: util.GenerateShortUID(),
			}

			go func() {
				result, dropped := r.Eval(data)
				resultCh <- evalRetval{result, dropped}
			}()

			select {
			case ctx := <-r.evalCh:
				require.Equal(t, data, ctx)
				result := <-resultCh // blocks
				require.True(t, result.success)
				require.Nilf(t, result.droppedEval, "expected no dropped evaluations but got one")
			case <-time.After(5 * time.Second):
				t.Fatal("No message was received on eval channel")
			}
		})
	})

	t.Run("when rule evaluation is stopped", func(t *testing.T) {
		t.Run("eval should do nothing", func(t *testing.T) {
			r := blankRecordingRuleForTests(context.Background())
			r.Stop(nil)
			ev := &Evaluation{
				scheduledAt: time.Now(),
				rule:        gen.GenerateRef(),
				folderTitle: util.GenerateShortUID(),
			}

			success, dropped := r.Eval(ev)

			require.False(t, success)
			require.Nilf(t, dropped, "expected no dropped evaluations but got one")
		})

		t.Run("calling stop multiple times should not panic", func(t *testing.T) {
			r := blankRecordingRuleForTests(context.Background())
			r.Stop(nil)
			r.Stop(nil)
		})

		t.Run("stop should not panic if parent context stopped", func(t *testing.T) {
			ctx, cancelFn := context.WithCancel(context.Background())
			r := blankRecordingRuleForTests(ctx)
			cancelFn()
			r.Stop(nil)
		})
	})

	t.Run("eval should be thread-safe", func(t *testing.T) {
		r := blankRecordingRuleForTests(context.Background())
		wg := sync.WaitGroup{}
		go func() {
			for {
				select {
				case <-r.evalCh:
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
						r.Update(&Evaluation{
							rule:        gen.GenerateRef(),
							folderTitle: util.GenerateShortUID(),
						})
					case 2:
						r.Eval(&Evaluation{
							scheduledAt: time.Now(),
							rule:        gen.GenerateRef(),
							folderTitle: util.GenerateShortUID(),
						})
					case 3:
						r.Stop(nil)
					}
				}
				wg.Done()
			}()
		}

		wg.Wait()
	})

	t.Run("Run should exit if idle when Stop is called", func(t *testing.T) {
		rule := blankRecordingRuleForTests(context.Background())
		runResult := make(chan error)
		go func() {
			runResult <- rule.Run()
		}()

		rule.Stop(nil)

		select {
		case err := <-runResult:
			require.NoError(t, err)
		case <-time.After(5 * time.Second):
			t.Fatal("Run() never exited")
		}
	})
}

func TestRecordingRuleIdentifier(t *testing.T) {
	t.Run("should return correct identifier", func(t *testing.T) {
		key := models.GenerateRuleKeyWithGroup(1)
		r := blankRecordingRuleForTests(context.Background())
		r.key = key
		require.Equal(t, key, r.Identifier())
	})
}

func blankRecordingRuleForTests(ctx context.Context) *recordingRule {
	st := setting.RecordingRuleSettings{
		Enabled: true,
	}
	return newRecordingRule(context.Background(), models.AlertRuleKeyWithGroup{}, 0, nil, nil, st, log.NewNopLogger(), nil, nil, writer.FakeWriter{}, nil, nil)
}

func TestRecordingRule_Integration(t *testing.T) {
	t.Run("with datasource writer", func(t *testing.T) {
		writeTarget := writer.NewTestRemoteWriteTarget(t)
		defer writeTarget.Close()
		writerReg := prometheus.NewPedanticRegistry()
		writer := setupDatasourceWriter(t, writeTarget, writerReg, "ds-uid")
		testRecordingRule_Integration(t, writeTarget, writer, writerReg, "ds-uid")
	})
}

func TestRecordingRuleAfterEval(t *testing.T) {
	gen := models.RuleGen.With(models.RuleGen.WithAllRecordingRules(), models.RuleGen.WithOrgID(123))

	type testContext struct {
		rule         *models.AlertRule
		process      Rule
		evalDoneChan chan time.Time
		afterEvalCh  chan struct{}
		callCount    *atomic.Int32
		mutex        *sync.Mutex
		scheduler    *schedule
		ruleStore    *fakeRulesStore // Use the concrete type for access to getNamespaceTitle
	}

	// Configuration struct for test setup
	type setupConfig struct {
		queryHealth          string
		enableRecordingRules bool
		isPaused             bool
		// Add any other configurable parameters here
	}

	// Default configuration
	defaultSetupConfig := setupConfig{
		queryHealth:          "ok",
		enableRecordingRules: true,
		isPaused:             false,
	}

	setup := func(t *testing.T, cfg setupConfig) *testContext {
		t.Helper()
		ruleStore := newFakeRulesStore()
		reg := prometheus.NewPedanticRegistry()
		sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil)
		sch.recordingWriter = writer.FakeWriter{}

		if !cfg.enableRecordingRules {
			sch.rrCfg.Enabled = false
		}

		rule := gen.With(withQueryForHealth(cfg.queryHealth)).GenerateRef()
		if cfg.isPaused {
			rule.IsPaused = true
		}
		ruleStore.PutRule(context.Background(), rule)
		ruleFactory := ruleFactoryFromScheduler(sch)

		process := ruleFactory.new(context.Background(), rule)

		evalDoneChan := make(chan time.Time, 1) // Buffer to avoid blocking
		afterEvalCh := make(chan struct{}, 1)   // Buffer to avoid blocking
		callCount := atomic.NewInt32(0)
		mutex := &sync.Mutex{}

		process.(*recordingRule).evalAppliedHook = func(_ models.AlertRuleKey, t time.Time) {
			evalDoneChan <- t
		}

		// Start the rule processing goroutine
		go func() {
			_ = process.Run()
		}()

		return &testContext{
			rule:         rule,
			process:      process,
			evalDoneChan: evalDoneChan,
			afterEvalCh:  afterEvalCh,
			callCount:    callCount,
			mutex:        mutex,
			scheduler:    sch,
			ruleStore:    ruleStore,
		}
	}

	runTest := func(t *testing.T, ctx *testContext, expectCallbackCalled bool) {
		t.Helper()

		now := time.Now()

		folderTitle := ctx.ruleStore.getNamespaceTitle(ctx.rule.NamespaceUID)

		eval := &Evaluation{
			scheduledAt: now,
			rule:        ctx.rule,
			folderTitle: folderTitle,
			afterEval: func() {
				ctx.callCount.Inc()
				select {
				case ctx.afterEvalCh <- struct{}{}:
				default:
					// Channel is full, which is fine for tests
				}
			},
		}

		// Send the evaluation
		ctx.process.Eval(eval)

		// For enabled rules that are not paused, we should see the evaluation complete
		if ctx.scheduler.rrCfg.Enabled && !ctx.rule.IsPaused {
			select {
			case <-ctx.evalDoneChan:
				// Evaluation was completed
			case <-time.After(5 * time.Second):
				t.Fatal("Evaluation was not completed in time")
			}
		}

		// Wait for potential afterEval execution
		waitDuration := 500 * time.Millisecond
		if expectCallbackCalled {
			select {
			case <-ctx.afterEvalCh:
				// Success - afterEval was called
			case <-time.After(5 * time.Second):
				t.Fatal("afterEval callback was not called")
			}
		} else {
			// Just wait a bit to make sure callback isn't called
			time.Sleep(waitDuration)
		}

		// Verify callback count
		count := ctx.callCount.Load()
		if expectCallbackCalled {
			require.Equal(t, int32(1), count, "afterEval callback should have been called exactly once")
		} else {
			require.Equal(t, int32(0), count, "afterEval callback should not have been called")
		}
	}

	t.Run("afterEval callback is called after successful evaluation", func(t *testing.T) {
		ctx := setup(t, defaultSetupConfig)
		runTest(t, ctx, true)
	})

	t.Run("afterEval callback is called even when evaluation fails", func(t *testing.T) {
		ctx := setup(t, setupConfig{
			queryHealth:          "error",
			enableRecordingRules: true,
			isPaused:             false,
		})
		runTest(t, ctx, true)

		// Verify that the rule evaluation did indeed fail
		status := ctx.process.(*recordingRule).Status()
		require.Equal(t, "error", status.Health)
		require.NotNil(t, status.LastError)
	})

	t.Run("afterEval callback is not called when recording rule feature is disabled", func(t *testing.T) {
		ctx := setup(t, setupConfig{
			queryHealth:          "ok",
			enableRecordingRules: false,
			isPaused:             false,
		})
		runTest(t, ctx, false)
	})

	t.Run("afterEval callback is called before stopping rule evaluation", func(t *testing.T) {
		ctx := setup(t, defaultSetupConfig)

		// Create a channel to signal when Stop is called
		stopSignalCh := make(chan struct{})

		// Send an evaluation that will be pending when we stop the rule
		now := time.Now()
		folderTitle := ctx.ruleStore.getNamespaceTitle(ctx.rule.NamespaceUID)
		eval := &Evaluation{
			scheduledAt: now,
			rule:        ctx.rule,
			folderTitle: folderTitle,
			afterEval: func() {
				// Wait until we know Stop has been called
				select {
				case <-stopSignalCh:
					// Stop was called before this callback executed
				case <-time.After(100 * time.Millisecond):
					t.Error("afterEval callback executed but Stop signal wasn't received")
				}

				ctx.callCount.Inc()
				select {
				case ctx.afterEvalCh <- struct{}{}:
				default:
					// Channel is full, which is fine for tests
				}
			},
		}
		ctx.process.Eval(eval)

		// Create a stopChan to verify rule stopping
		stopChan := make(chan struct{})
		go func() {
			// Signal that we're about to call Stop
			close(stopSignalCh)
			ctx.process.Stop(nil)
			close(stopChan)
		}()

		// Verify afterEval was called during stopping
		select {
		case <-ctx.afterEvalCh:
			// Success - afterEval was called during stopping
		case <-time.After(5 * time.Second):
			t.Fatal("afterEval callback was not called during rule stopping")
		}

		// Verify the rule stopped properly
		select {
		case <-stopChan:
			// Success - the rule stopped
		case <-time.After(5 * time.Second):
			t.Fatal("Rule did not stop in time")
		}

		// Verify callback count
		count := ctx.callCount.Load()
		require.Equal(t, int32(1), count, "afterEval callback should have been called exactly once during stopping")
	})

	t.Run("afterEval callback is still called when rule is paused", func(t *testing.T) {
		ctx := setup(t, setupConfig{
			queryHealth:          "ok",
			enableRecordingRules: true,
			isPaused:             true,
		})
		runTest(t, ctx, true)

		// Verify the rule status
		status := ctx.process.(*recordingRule).Status()
		require.Equal(t, "unknown", status.Health, "Paused rule should have 'unknown' health since it's not evaluated")
	})
}

func testRecordingRule_Integration(t *testing.T, writeTarget *writer.TestRemoteWriteTarget, writer RecordingWriter, writerReg *prometheus.Registry, dsUID string) {
	gen := models.RuleGen.With(models.RuleGen.WithAllRecordingRules(), models.RuleGen.WithOrgID(123))
	ruleStore := newFakeRulesStore()
	reg := prometheus.NewPedanticRegistry()
	sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil)
	sch.recordingWriter = writer

	t.Run("rule that succeeds", func(t *testing.T) {
		writeTarget.Reset()
		rule := gen.With(withQueryForHealth("ok")).GenerateRef()
		rule.Record.TargetDatasourceUID = dsUID
		ruleStore.PutRule(context.Background(), rule)
		folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
		ruleFactory := ruleFactoryFromScheduler(sch)

		process := ruleFactory.new(context.Background(), rule)
		evalDoneChan := make(chan time.Time)
		process.(*recordingRule).evalAppliedHook = func(_ models.AlertRuleKey, t time.Time) {
			evalDoneChan <- t
		}
		now := time.Now()

		go func() {
			_ = process.Run()
		}()

		t.Run("status shows no evaluations", func(t *testing.T) {
			status := process.(*recordingRule).Status()

			require.Equal(t, "unknown", status.Health)
			require.Nil(t, status.LastError)
			require.Zero(t, status.EvaluationTimestamp)
			require.Zero(t, status.EvaluationDuration)
		})

		process.Eval(&Evaluation{
			scheduledAt: now,
			rule:        rule,
			folderTitle: folderTitle,
		})
		_ = waitForTimeChannel(t, evalDoneChan)

		t.Run("reports basic evaluation metrics", func(t *testing.T) {
			expectedMetric := fmt.Sprintf(
				`
				# HELP grafana_alerting_rule_evaluation_duration_seconds The time to evaluate a rule.
				# TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 1
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 1
				grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
				grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 1
				# HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
				# TYPE grafana_alerting_rule_evaluations_total counter
				grafana_alerting_rule_evaluations_total{org="%[1]d"} 1
				# HELP grafana_alerting_rule_evaluation_attempts_total The total number of rule evaluation attempts.
				 # TYPE grafana_alerting_rule_evaluation_attempts_total counter
				grafana_alerting_rule_evaluation_attempts_total{org="%[1]d"} 1
				`,
				rule.OrgID,
			)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_rule_evaluation_duration_seconds",
				"grafana_alerting_rule_evaluations_total",
				"grafana_alerting_rule_evaluation_attempts_total",
			)
			require.NoError(t, err)
		})

		t.Run("reports success evaluation metrics", func(t *testing.T) {
			expectedMetric := fmt.Sprintf(
				`
				# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
				# TYPE grafana_alerting_rule_evaluation_failures_total counter
				grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 0
				# HELP grafana_alerting_rule_evaluation_attempt_failures_total The total number of rule evaluation attempt failures.
				# TYPE grafana_alerting_rule_evaluation_attempt_failures_total counter
				grafana_alerting_rule_evaluation_attempt_failures_total{org="%[1]d"} 0
				`,
				rule.OrgID,
			)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_rule_evaluation_failures_total",
				"grafana_alerting_rule_evaluation_attempt_failures_total",
			)
			require.NoError(t, err)
		})

		t.Run("reports remote write metrics", func(t *testing.T) {
			expectedMetric := fmt.Sprintf(
				`
				# HELP grafana_alerting_remote_writer_write_duration_seconds Histogram of remote write durations.
				# TYPE grafana_alerting_remote_writer_write_duration_seconds histogram
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.005"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.01"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.025"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.05"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.1"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.25"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.5"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="1"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="2.5"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="5"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="10"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="+Inf"} 1
				grafana_alerting_remote_writer_write_duration_seconds_sum{backend="prometheus",org="%[1]d"} 0
				grafana_alerting_remote_writer_write_duration_seconds_count{backend="prometheus",org="%[1]d"} 1
				# HELP grafana_alerting_remote_writer_writes_total The total number of remote writes attempted.
				# TYPE grafana_alerting_remote_writer_writes_total counter
				grafana_alerting_remote_writer_writes_total{backend="prometheus", org="%[1]d", status_code="200"} 1
				`,
				rule.OrgID,
			)

			err := testutil.GatherAndCompare(writerReg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_remote_writer_writes_total",
				"grafana_alerting_remote_writer_write_duration_seconds",
			)
			require.NoError(t, err)
		})

		t.Run("status shows evaluation", func(t *testing.T) {
			status := process.(*recordingRule).Status()

			require.Equal(t, "ok", status.Health)
			require.Nil(t, status.LastError)
		})

		t.Run("write was performed", func(t *testing.T) {
			require.NotZero(t, writeTarget.RequestsCount)
			require.Contains(t, writeTarget.LastRequestBody, "some_metric")
		})
	})

	t.Run("rule that errors", func(t *testing.T) {
		writeTarget.Reset()
		rule := gen.With(withQueryForHealth("error")).GenerateRef()
		ruleStore.PutRule(context.Background(), rule)
		folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
		ruleFactory := ruleFactoryFromScheduler(sch)

		process := ruleFactory.new(context.Background(), rule)
		evalDoneChan := make(chan time.Time)
		process.(*recordingRule).evalAppliedHook = func(_ models.AlertRuleKey, t time.Time) {
			evalDoneChan <- t
		}
		now := time.Now()

		go func() {
			_ = process.Run()
		}()

		t.Run("status shows no evaluations", func(t *testing.T) {
			status := process.(*recordingRule).Status()

			require.Equal(t, "unknown", status.Health)
			require.Nil(t, status.LastError)
			require.Zero(t, status.EvaluationTimestamp)
			require.Zero(t, status.EvaluationDuration)
		})

		process.Eval(&Evaluation{
			scheduledAt: now,
			rule:        rule,
			folderTitle: folderTitle,
		})
		_ = waitForTimeChannel(t, evalDoneChan)

		t.Run("reports basic evaluation metrics", func(t *testing.T) {
			expectedMetric := fmt.Sprintf(
				`
				# HELP grafana_alerting_rule_evaluation_duration_seconds The time to evaluate a rule.
				# TYPE grafana_alerting_rule_evaluation_duration_seconds histogram
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.01"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.1"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="0.5"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="1"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="5"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="10"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="15"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="30"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="60"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="120"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="180"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="240"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="300"} 2
				grafana_alerting_rule_evaluation_duration_seconds_bucket{org="%[1]d",le="+Inf"} 2
				grafana_alerting_rule_evaluation_duration_seconds_sum{org="%[1]d"} 0
				grafana_alerting_rule_evaluation_duration_seconds_count{org="%[1]d"} 2
				# HELP grafana_alerting_rule_evaluations_total The total number of rule evaluations.
				# TYPE grafana_alerting_rule_evaluations_total counter
				grafana_alerting_rule_evaluations_total{org="%[1]d"} 2
				# HELP grafana_alerting_rule_evaluation_attempts_total The total number of rule evaluation attempts.
				 # TYPE grafana_alerting_rule_evaluation_attempts_total counter
				grafana_alerting_rule_evaluation_attempts_total{org="%[1]d"} 2
				`,
				rule.OrgID,
			)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_rule_evaluation_duration_seconds",
				"grafana_alerting_rule_evaluations_total",
				"grafana_alerting_rule_evaluation_attempts_total",
			)
			require.NoError(t, err)
		})

		t.Run("reports failure evaluation metrics", func(t *testing.T) {
			expectedMetric := fmt.Sprintf(
				`
				# HELP grafana_alerting_rule_evaluation_failures_total The total number of rule evaluation failures.
				# TYPE grafana_alerting_rule_evaluation_failures_total counter
				grafana_alerting_rule_evaluation_failures_total{org="%[1]d"} 1
				# HELP grafana_alerting_rule_evaluation_attempt_failures_total The total number of rule evaluation attempt failures.
				# TYPE grafana_alerting_rule_evaluation_attempt_failures_total counter
				grafana_alerting_rule_evaluation_attempt_failures_total{org="%[1]d"} 1
				`,
				rule.OrgID,
			)

			err := testutil.GatherAndCompare(reg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_rule_evaluation_failures_total",
				"grafana_alerting_rule_evaluation_attempt_failures_total",
			)
			require.NoError(t, err)
		})

		t.Run("reports remote write metrics", func(t *testing.T) {
			expectedMetric := fmt.Sprintf(
				`
				# HELP grafana_alerting_remote_writer_write_duration_seconds Histogram of remote write durations.
				# TYPE grafana_alerting_remote_writer_write_duration_seconds histogram
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.005"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.01"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.025"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.05"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.1"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.25"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="0.5"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="1"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="2.5"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="5"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="10"} 1
				grafana_alerting_remote_writer_write_duration_seconds_bucket{backend="prometheus",org="%[1]d",le="+Inf"} 1
				grafana_alerting_remote_writer_write_duration_seconds_sum{backend="prometheus",org="%[1]d"} 0
				grafana_alerting_remote_writer_write_duration_seconds_count{backend="prometheus",org="%[1]d"} 1
				# HELP grafana_alerting_remote_writer_writes_total The total number of remote writes attempted.
				# TYPE grafana_alerting_remote_writer_writes_total counter
				grafana_alerting_remote_writer_writes_total{backend="prometheus", org="%[1]d", status_code="200"} 1
				`,
				rule.OrgID,
			)

			err := testutil.GatherAndCompare(writerReg, bytes.NewBufferString(expectedMetric),
				"grafana_alerting_remote_writer_writes_total",
				"grafana_alerting_remote_writer_write_duration_seconds",
			)
			require.NoError(t, err)
		})

		t.Run("status shows evaluation", func(t *testing.T) {
			status := process.(*recordingRule).Status()

			require.Equal(t, "error", status.Health)
			require.NotNil(t, status.LastError)
			require.ErrorContains(t, status.LastError, "unable to find dependent node")
		})

		t.Run("no write was performed", func(t *testing.T) {
			require.Zero(t, writeTarget.RequestsCount)
		})
	})

	t.Run("nodata rule", func(t *testing.T) {
		rule := gen.With(withQueryForHealth("nodata")).GenerateRef()
		ruleStore.PutRule(context.Background(), rule)
		folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
		ruleFactory := ruleFactoryFromScheduler(sch)

		process := ruleFactory.new(context.Background(), rule)
		evalDoneChan := make(chan time.Time)
		process.(*recordingRule).evalAppliedHook = func(_ models.AlertRuleKey, t time.Time) {
			evalDoneChan <- t
		}
		now := time.Now()

		go func() {
			_ = process.Run()
		}()

		t.Run("status shows no evaluations", func(t *testing.T) {
			status := process.(*recordingRule).Status()

			require.Equal(t, "unknown", status.Health)
			require.Nil(t, status.LastError)
			require.Zero(t, status.EvaluationTimestamp)
			require.Zero(t, status.EvaluationDuration)
		})

		process.Eval(&Evaluation{
			scheduledAt: now,
			rule:        rule,
			folderTitle: folderTitle,
		})
		_ = waitForTimeChannel(t, evalDoneChan)

		t.Run("status shows evaluation", func(t *testing.T) {
			status := process.(*recordingRule).Status()

			// TODO: assert "error" to fix test, update to "nodata" in the future
			require.Equal(t, "error", status.Health)
		})
	})

	t.Run("rule with private labels filtered", func(t *testing.T) {
		writeTarget.Reset()
		rule := gen.With(withQueryForHealth("ok")).GenerateRef()
		rule.Record.TargetDatasourceUID = dsUID
		rule.Labels = map[string]string{
			"normal_label":     "value1",
			"another_label":    "value2",
			"__private__":      "filtered",
			"__also_private__": "filtered",
			"__only_start":     "not_filtered",
			"only_end__":       "not_filtered",
		}

		ruleStore.PutRule(context.Background(), rule)
		folderTitle := ruleStore.getNamespaceTitle(rule.NamespaceUID)
		ruleFactory := ruleFactoryFromScheduler(sch)

		process := ruleFactory.new(context.Background(), rule)
		evalDoneChan := make(chan time.Time)
		process.(*recordingRule).evalAppliedHook = func(_ models.AlertRuleKey, t time.Time) {
			evalDoneChan <- t
		}
		now := time.Now()

		go func() {
			_ = process.Run()
		}()

		process.Eval(&Evaluation{
			scheduledAt: now,
			rule:        rule,
			folderTitle: folderTitle,
		})
		_ = waitForTimeChannel(t, evalDoneChan)

		t.Run("write was performed with filtered labels", func(t *testing.T) {
			require.Equal(t, 1, writeTarget.RequestsCount)
			require.NotEmpty(t, writeTarget.LastRequestBody)

			// Check that the body doesn't contain the private labels
			require.NotContains(t, writeTarget.LastRequestBody, "__private__")
			require.NotContains(t, writeTarget.LastRequestBody, "__also_private__")

			require.Contains(t, writeTarget.LastRequestBody, rule.Record.Metric)
		})
	})
}

func withQueryForHealth(health string) models.AlertRuleMutator {
	var expression string
	switch health {
	case "ok":
		expression = `{
			"datasourceUid": "__expr__",
			"type":"math",
			"expression":"2 + 1"
		}`
	case "error":
		expression = `{
			"datasourceUid": "__expr__",
			"type":"math",
			"expression":"$NOTEXIST"
		}`
	case "nodata":
		expression = `{
			"datasourceUid": "__expr__",
			"type":"math",
			"expression":"null()"
		}`
	default:
		panic(fmt.Sprintf("Query generation for health %s is not supported yet", health))
	}

	return func(rule *models.AlertRule) {
		rule.Record.From = "A"
		rule.Data = []models.AlertQuery{
			{
				DatasourceUID: expr.DatasourceUID,
				Model:         json.RawMessage(expression),
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(5 * time.Hour),
					To:   models.Duration(3 * time.Hour),
				},
				RefID: "A",
			},
		}
	}
}

func setupDatasourceWriter(t *testing.T, target *writer.TestRemoteWriteTarget, reg prometheus.Registerer, dsUID string) *writer.DatasourceWriter {
	provider := testClientProvider{}
	m := metrics.NewNGAlert(reg)

	dss := &dsfakes.FakeDataSourceService{}
	p1, _ := dss.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
		UID:      dsUID,
		Type:     datasources.DS_PROMETHEUS,
		JsonData: simplejson.MustJson([]byte(`{"prometheusType":"Prometheus"}`)),
	})
	p1.URL = target.DatasourceURL()

	cfg := writer.DatasourceWriterConfig{
		Timeout:              time.Second * 5,
		DefaultDatasourceUID: "",
	}

	mockPluginConfig := &mockPluginContextProvider{}
	return writer.NewDatasourceWriter(cfg, dss, provider, mockPluginConfig, clock.NewMock(),
		log.New("test"), m.GetRemoteWriterMetrics())
}

type testClientProvider struct{}

func (t testClientProvider) New(options ...httpclient.Options) (*http.Client, error) {
	return &http.Client{}, nil
}

type mockPluginContextProvider struct{}

func (m *mockPluginContextProvider) GetWithDataSource(ctx context.Context, pluginID string, user identity.Requester, ds *datasources.DataSource) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

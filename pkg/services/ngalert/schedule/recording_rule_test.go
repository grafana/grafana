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

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
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
	gen := models.RuleGen.With(models.RuleGen.WithAllRecordingRules(), models.RuleGen.WithOrgID(123))
	ruleStore := newFakeRulesStore()
	reg := prometheus.NewPedanticRegistry()
	sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil)
	writeTarget := writer.NewTestRemoteWriteTarget(t)
	defer writeTarget.Close()
	writerReg := prometheus.NewPedanticRegistry()
	sch.recordingWriter = setupWriter(t, writeTarget, writerReg)

	t.Run("rule that succeeds", func(t *testing.T) {
		writeTarget.Reset()
		rule := gen.With(withQueryForHealth("ok")).GenerateRef()
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

func setupWriter(t *testing.T, target *writer.TestRemoteWriteTarget, reg prometheus.Registerer) *writer.PrometheusWriter {
	provider := testClientProvider{}
	m := metrics.NewNGAlert(reg)
	wr, err := writer.NewPrometheusWriter(target.ClientSettings(), provider, clock.NewMock(), log.NewNopLogger(), m.GetRemoteWriterMetrics())
	require.NoError(t, err)
	return wr
}

type testClientProvider struct{}

func (t testClientProvider) New(options ...httpclient.Options) (*http.Client, error) {
	return &http.Client{}, nil
}

package schedule

import (
	context "context"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
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
						r.Update(RuleVersionAndPauseStatus{fingerprint(rand.Uint64()), false})
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
			runResult <- rule.Run(models.AlertRuleKey{})
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

func blankRecordingRuleForTests(ctx context.Context) *recordingRule {
	return newRecordingRule(context.Background(), 0, nil, nil, log.NewNopLogger(), nil)
}

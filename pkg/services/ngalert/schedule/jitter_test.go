package schedule

import (
	"testing"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
)

func TestJitter(t *testing.T) {
	t.Run("when strategy is JitterNever", func(t *testing.T) {
		t.Run("offset is always zero", func(t *testing.T) {
			rules := createTestRules(100, ngmodels.WithIntervalBetween(10, 600))
			baseInterval := 10 * time.Second

			for _, r := range rules {
				offset := jitterOffsetInTicks(r, baseInterval, JitterNever)
				require.Zero(t, offset, "unexpected offset, should be zero with jitter disabled; got %d", offset)
			}
		})
	})

	t.Run("when strategy is JitterByGroup", func(t *testing.T) {
		t.Run("offset is stable for the same rule", func(t *testing.T) {
			rule := ngmodels.AlertRuleGen(ngmodels.WithIntervalBetween(10, 600))()
			baseInterval := 10 * time.Second
			original := jitterOffsetInTicks(rule, baseInterval, JitterByGroup)

			for i := 0; i < 100; i++ {
				offset := jitterOffsetInTicks(rule, baseInterval, JitterByGroup)
				require.Equal(t, original, offset, "jitterOffsetInTicks should return the same value for the same rule")
			}
		})

		t.Run("offset is on the interval [0, interval/baseInterval)", func(t *testing.T) {
			baseInterval := 10 * time.Second
			rules := createTestRules(1000, ngmodels.WithIntervalBetween(10, 600))

			for _, r := range rules {
				offset := jitterOffsetInTicks(r, baseInterval, JitterByGroup)
				require.GreaterOrEqual(t, offset, int64(0), "offset cannot be negative, got %d for rule with interval %d", offset, r.IntervalSeconds)
				upperLimit := r.IntervalSeconds / int64(baseInterval.Seconds())
				require.Less(t, offset, upperLimit, "offset cannot be equal to or greater than interval/baseInterval of %d", upperLimit)
			}
		})

		t.Run("offset for any rule in the same group is always the same", func(t *testing.T) {
			baseInterval := 10 * time.Second
			group1 := ngmodels.AlertRuleGroupKey{}
			group2 := ngmodels.AlertRuleGroupKey{}
			rules1 := createTestRules(1000, ngmodels.WithInterval(60*time.Second), ngmodels.WithGroupKey(group1))
			rules2 := createTestRules(1000, ngmodels.WithInterval(1*time.Hour), ngmodels.WithGroupKey(group2))

			group1Offset := jitterOffsetInTicks(rules1[0], baseInterval, JitterByGroup)
			for _, r := range rules1 {
				offset := jitterOffsetInTicks(r, baseInterval, JitterByGroup)
				require.Equal(t, group1Offset, offset)
			}
			group2Offset := jitterOffsetInTicks(rules2[0], baseInterval, JitterByGroup)
			for _, r := range rules2 {
				offset := jitterOffsetInTicks(r, baseInterval, JitterByGroup)
				require.Equal(t, group2Offset, offset)
			}
		})
	})

	t.Run("when strategy is JitterByRule", func(t *testing.T) {
		t.Run("offset is stable for the same rule", func(t *testing.T) {
			rule := ngmodels.AlertRuleGen(ngmodels.WithIntervalBetween(10, 600))()
			baseInterval := 10 * time.Second
			original := jitterOffsetInTicks(rule, baseInterval, JitterByRule)

			for i := 0; i < 100; i++ {
				offset := jitterOffsetInTicks(rule, baseInterval, JitterByRule)
				require.Equal(t, original, offset, "jitterOffsetInTicks should return the same value for the same rule")
			}
		})

		t.Run("offset is on the interval [0, interval/baseInterval)", func(t *testing.T) {
			baseInterval := 10 * time.Second
			rules := createTestRules(1000, ngmodels.WithIntervalBetween(10, 600))

			for _, r := range rules {
				offset := jitterOffsetInTicks(r, baseInterval, JitterByRule)
				require.GreaterOrEqual(t, offset, int64(0), "offset cannot be negative, got %d for rule with interval %d", offset, r.IntervalSeconds)
				upperLimit := r.IntervalSeconds / int64(baseInterval.Seconds())
				require.Less(t, offset, upperLimit, "offset cannot be equal to or greater than interval/baseInterval of %d", upperLimit)
			}
		})
	})
}

func createTestRules(n int, mutators ...ngmodels.AlertRuleMutator) []*ngmodels.AlertRule {
	result := make([]*ngmodels.AlertRule, 0, n)
	for i := 0; i < n; i++ {
		result = append(result, ngmodels.AlertRuleGen(mutators...)())
	}
	return result
}

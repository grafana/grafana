package schedule

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestJitter(t *testing.T) {
	gen := ngmodels.RuleGen
	genWithInterval10to600 := gen.With(gen.WithIntervalBetween(10, 600))
	t.Run("when strategy is JitterNever", func(t *testing.T) {
		t.Run("offset is always zero", func(t *testing.T) {
			rules := genWithInterval10to600.GenerateManyRef(100)
			baseInterval := 10 * time.Second

			for _, r := range rules {
				offset := jitterOffsetInTicks(r, baseInterval, JitterNever)
				require.Zero(t, offset, "unexpected offset, should be zero with jitter disabled; got %d", offset)
			}
		})
	})

	t.Run("when strategy is JitterByGroup", func(t *testing.T) {
		t.Run("offset is stable for the same rule", func(t *testing.T) {
			rule := genWithInterval10to600.GenerateRef()
			baseInterval := 10 * time.Second
			original := jitterOffsetInTicks(rule, baseInterval, JitterByGroup)

			for range 100 {
				offset := jitterOffsetInTicks(rule, baseInterval, JitterByGroup)
				require.Equal(t, original, offset, "jitterOffsetInTicks should return the same value for the same rule")
			}
		})

		t.Run("offset is on the interval [0, interval/baseInterval)", func(t *testing.T) {
			baseInterval := 10 * time.Second
			rules := genWithInterval10to600.GenerateManyRef(1000)

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
			rules1 := gen.With(gen.WithInterval(60*time.Second), gen.WithGroupKey(group1)).GenerateManyRef(1000)
			rules2 := gen.With(gen.WithInterval(1*time.Hour), gen.WithGroupKey(group2)).GenerateManyRef(1000)

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
			rule := genWithInterval10to600.GenerateRef()
			baseInterval := 10 * time.Second
			original := jitterOffsetInTicks(rule, baseInterval, JitterByRule)

			for range 100 {
				offset := jitterOffsetInTicks(rule, baseInterval, JitterByRule)
				require.Equal(t, original, offset, "jitterOffsetInTicks should return the same value for the same rule")
			}
		})

		t.Run("offset is on the interval [0, interval/baseInterval)", func(t *testing.T) {
			baseInterval := 10 * time.Second
			rules := genWithInterval10to600.GenerateManyRef(1000)

			for _, r := range rules {
				offset := jitterOffsetInTicks(r, baseInterval, JitterByRule)
				require.GreaterOrEqual(t, offset, int64(0), "offset cannot be negative, got %d for rule with interval %d", offset, r.IntervalSeconds)
				upperLimit := r.IntervalSeconds / int64(baseInterval.Seconds())
				require.Less(t, offset, upperLimit, "offset cannot be equal to or greater than interval/baseInterval of %d", upperLimit)
			}
		})
	})
}

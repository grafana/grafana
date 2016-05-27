package alerting

import (
	m "github.com/grafana/grafana/pkg/models"
)

func (this *GraphiteExecutor) executeRules(series []GraphiteSerie, rule m.AlertRule) *AlertResult {
	for _, v := range series {
		var avg float64
		var sum float64
		for _, dp := range v.Datapoints {
			sum += dp[0]
		}

		avg = sum / float64(len(v.Datapoints))

		if float64(rule.CritLevel) < avg {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: avg}
		}

		if float64(rule.WarnLevel) < avg {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: avg}
		}

		if float64(rule.CritLevel) < sum {
			return &AlertResult{State: m.AlertStateCritical, Id: rule.Id, ActualValue: sum}
		}

		if float64(rule.WarnLevel) < sum {
			return &AlertResult{State: m.AlertStateWarn, Id: rule.Id, ActualValue: sum}
		}
	}

	return &AlertResult{State: m.AlertStateOk, Id: rule.Id}
}

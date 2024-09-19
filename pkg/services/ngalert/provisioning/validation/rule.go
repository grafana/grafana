package validation

import (
	"fmt"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	prommodels "github.com/prometheus/common/model"
)

func ValidateRule(rule ngmodels.AlertRule) (ngmodels.AlertRule, error) {
	var err error

	// TODO: validate rule beyond recording rule fields
	if rule.Type() == ngmodels.RuleTypeRecording {
		rule, err = validateRecordingRuleFields(rule)
	}

	return rule, err
}

func validateRecordingRuleFields(rule ngmodels.AlertRule) (ngmodels.AlertRule, error) {
	metricName := prommodels.LabelValue(rule.Record.Metric)
	if !metricName.IsValid() {
		return ngmodels.AlertRule{}, fmt.Errorf("%w: %s", ngmodels.ErrAlertRuleFailedValidation, "metric name for recording rule must be a valid utf8 string")
	}
	if !prommodels.IsValidMetricName(metricName) {
		return ngmodels.AlertRule{}, fmt.Errorf("%w: %s", ngmodels.ErrAlertRuleFailedValidation, "metric name for recording rule must be a valid Prometheus metric name")
	}

	clearRecordingRuleIgnoredFields(&rule)

	return rule, nil
}

func clearRecordingRuleIgnoredFields(rule *ngmodels.AlertRule) {
	rule.NoDataState = ""
	rule.ExecErrState = ""
	rule.Condition = ""
	rule.For = 0
	rule.NotificationSettings = nil
}

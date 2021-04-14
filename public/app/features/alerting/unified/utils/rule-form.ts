import { describeInterval } from '@grafana/data/src/datetime/rangeutil';
import { RulerAlertingRuleDTO, RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';
import { RuleFormValues } from '../types/rule-form';
import { arrayToRecord } from './misc';

export function formValuesToRulerAlertingRuleDTO(values: RuleFormValues): RulerAlertingRuleDTO {
  const { name, expression, forTime, forTimeUnit } = values;
  return {
    alert: name,
    for: `${forTime}${forTimeUnit}`,
    annotations: arrayToRecord(values.annotations || []),
    labels: arrayToRecord(values.labels || []),
    expr: expression,
  };
}

function intervalToSeconds(interval: string): number {
  const { sec, count } = describeInterval(interval);
  return sec * count;
}

export function formValuesToRulerGrafanaRuleDTO(values: RuleFormValues): RulerGrafanaRuleDTO {
  const { name, condition, noDataState, execErrState, evaluateFor, queries } = values;
  if (condition) {
    return {
      grafana_alert: {
        title: name,
        condition,
        for: intervalToSeconds(evaluateFor), // @TODO provide raw string once backend supports it
        no_data_state: noDataState,
        exec_err_state: execErrState,
        data: queries,
        annotations: arrayToRecord(values.annotations || []),
        labels: arrayToRecord(values.labels || []),
      },
    };
  }
  throw new Error('Cannot create rule without specifying alert condition');
}

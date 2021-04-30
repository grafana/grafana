import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  Annotations,
  GrafanaAlertState,
  Labels,
  PostableRuleGrafanaRuleDTO,
  RulerAlertingRuleDTO,
} from 'app/types/unified-alerting-dto';
import { SAMPLE_QUERIES } from '../mocks/grafana-queries';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { isGrafanaRulesSource } from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import { isAlertingRulerRule, isGrafanaRulerRule } from './rules';

export const defaultFormValues: RuleFormValues = Object.freeze({
  name: '',
  labels: [{ key: '', value: '' }],
  annotations: [{ key: '', value: '' }],
  dataSourceName: null,

  // threshold
  folder: null,
  queries: SAMPLE_QUERIES, // @TODO remove the sample eventually
  condition: '',
  noDataState: GrafanaAlertState.NoData,
  execErrState: GrafanaAlertState.Alerting,
  evaluateEvery: '1m',
  evaluateFor: '5m',

  // system
  group: '',
  namespace: '',
  expression: '',
  forTime: 1,
  forTimeUnit: 'm',
});

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

function parseInterval(value: string): [number, string] {
  const match = value.match(/(\d+)(\w+)/);
  if (match) {
    return [Number(match[1]), match[2]];
  }
  throw new Error(`Invalid interval description: ${value}`);
}

function listifyLabelsOrAnnotations(item: Labels | Annotations | undefined): Array<{ key: string; value: string }> {
  return [...recordToArray(item || {}), { key: '', value: '' }];
}

export function formValuesToRulerGrafanaRuleDTO(values: RuleFormValues): PostableRuleGrafanaRuleDTO {
  const { name, condition, noDataState, execErrState, evaluateFor, queries } = values;
  if (condition) {
    return {
      grafana_alert: {
        title: name,
        condition,
        no_data_state: noDataState,
        exec_err_state: execErrState,
        data: queries,
      },
      for: evaluateFor,
      annotations: arrayToRecord(values.annotations || []),
      labels: arrayToRecord(values.labels || []),
    };
  }
  throw new Error('Cannot create rule without specifying alert condition');
}

export function rulerRuleToFormValues(ruleWithLocation: RuleWithLocation): RuleFormValues {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;
  if (isGrafanaRulesSource(ruleSourceName)) {
    if (isGrafanaRulerRule(rule)) {
      const ga = rule.grafana_alert;
      return {
        ...defaultFormValues,
        name: ga.title,
        type: RuleFormType.threshold,
        evaluateFor: rule.for,
        evaluateEvery: group.interval || defaultFormValues.evaluateEvery,
        noDataState: ga.no_data_state,
        execErrState: ga.exec_err_state,
        queries: ga.data,
        condition: ga.condition,
        annotations: listifyLabelsOrAnnotations(rule.annotations),
        labels: listifyLabelsOrAnnotations(rule.labels),
        folder: { title: namespace, id: -1 },
      };
    } else {
      throw new Error('Unexpected type of rule for grafana rules source');
    }
  } else {
    if (isAlertingRulerRule(rule)) {
      const [forTime, forTimeUnit] = rule.for
        ? parseInterval(rule.for)
        : [defaultFormValues.forTime, defaultFormValues.forTimeUnit];
      return {
        ...defaultFormValues,
        name: rule.alert,
        type: RuleFormType.system,
        dataSourceName: ruleSourceName,
        namespace,
        group: group.name,
        expression: rule.expr,
        forTime,
        forTimeUnit,
        annotations: listifyLabelsOrAnnotations(rule.annotations),
        labels: listifyLabelsOrAnnotations(rule.labels),
      };
    } else {
      throw new Error('Editing recording rules not supported (yet)');
    }
  }
}

import { randomLogNormal } from 'd3-random';
import { Factory } from 'fishery';

import { AlertInstance, AlertingRule, RecordingRule, RuleGroup } from './api';
import {
  PrometheusAlertingRuleDefinition,
  PrometheusRecordingRuleDefinition,
  PrometheusRuleGroupDefinition,
} from './definitions';

const evaluationTime = randomLogNormal(0, 0.5);

/* mock a API alerting rule object */
export const PrometheusAlertingRuleFactory = Factory.define<AlertingRule>(
  ({ sequence, params: { state = 'firing' } }) => {
    const labels = {
      label1: 'value1',
      label2: 'value2',
    };

    const annotations = {
      annotation1: 'value1',
      annotation2: 'value2',
    };

    return {
      type: 'alerting',
      name: `Alert Rule #${sequence}`,
      query: 'up == 0',
      state,
      annotations,
      labels,
      alerts: PrometheusAlertFactory.buildList(3, {
        state,
        labels,
        annotations,
      }),
      duration: 60, // equavalent to "1m"
      health: 'ok',
      evaluationTime: evaluationTime(),
      lastEvaluation: new Date().toISOString(),
    } satisfies AlertingRule;
  }
);

/* mock a API alert object, embedded in Alert Rule API object */
export const PrometheusAlertFactory = Factory.define<AlertInstance>(() => {
  return {
    value: '1',
    annotations: {},
    labels: {},
    state: 'firing',
    activeAt: new Date().toISOString(),
    keepFiringSince: new Date().toISOString(),
  } satisfies AlertInstance;
});

/* mock a YAML alerting rule definition */
export const PrometheusAlertingRuleDefinitionFactory = Factory.define<PrometheusAlertingRuleDefinition>(
  ({ sequence }) => {
    return {
      alert: `Alert Rule #${sequence}`,
      expr: 'up == 0',
      for: '1m',
      annotations: {
        annotation1: 'value1',
        annotation2: 'value2',
      },
      labels: {
        label1: 'value1',
        label2: 'value2',
      },
    } satisfies PrometheusAlertingRuleDefinition;
  }
);

/* mock a API recording rule object */
export const PrometheusRecordingRuleFactory = Factory.define<RecordingRule>(({ sequence }) => {
  return {
    type: 'recording',
    name: `Recording Rule #${sequence}`,
    query: 'vector(1)',
    labels: {
      label1: 'value1',
      label2: 'value2',
    },
    health: 'ok',
    evaluationTime: evaluationTime(),
    lastEvaluation: new Date().toISOString(),
  } satisfies RecordingRule;
});

/* mock a YAML alerting rule definition */
export const PrometheusRecordingRuleDefinitionFactory = Factory.define<PrometheusRecordingRuleDefinition>(
  ({ sequence }) => {
    return {
      record: `Recording Rule #${sequence}`,
      expr: 'vector(1)',
      labels: {
        label1: 'value1',
        label2: 'value2',
      },
    } satisfies PrometheusRecordingRuleDefinition;
  }
);

/* mock a PrometheusRuleGroup API object */
export const PrometheusRuleGroupFactory = Factory.define<RuleGroup>(({ sequence }) => {
  return {
    name: `Rule Group #${sequence}`,
    file: 'default',
    // 1 recording rule + 2 alerting rules
    rules: [PrometheusRecordingRuleFactory.build(), ...PrometheusAlertingRuleFactory.buildList(2)],
    interval: 60,
    evaluationTime: evaluationTime(),
    lastEvaluation: new Date().toISOString(),
  } satisfies RuleGroup;
});

/* mock a YAML PrometheusRuleGroup definition */
export const PrometheusRuleGroupDefinitionFactory = Factory.define<PrometheusRuleGroupDefinition>(({ sequence }) => {
  return {
    name: `Rule Group #${sequence}`,
    limit: 0,
    interval: '1m',
    labels: {
      label1: 'value1',
      label2: 'value2',
    },
    // 1 recording rule + 2 alerting rules
    rules: [PrometheusRecordingRuleDefinitionFactory.build(), ...PrometheusAlertingRuleDefinitionFactory.buildList(2)],
  } satisfies PrometheusRuleGroupDefinition;
});

import { randomLogNormal } from 'd3-random';
import { Factory } from 'fishery';

import { AlertInstance, AlertingRule, RecordingRule, RuleGroup } from './api';
import { AlertingRuleDefinition, RecordingRuleDefinition, RuleGroupDefinition } from './definitions';

const evaluationTime = randomLogNormal(0, 0.5);

/* mock a API alerting rule object */
export const AlertingRuleFactory = Factory.define<AlertingRule>(({ sequence, params: { state = 'firing' } }) => {
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
    alerts: AlertFactory.buildList(3, {
      state,
      labels,
      annotations,
    }),
    duration: 60, // equavalent to "1m"
    health: 'ok',
    evaluationTime: evaluationTime(),
    lastEvaluation: new Date().toISOString(),
  } satisfies AlertingRule;
});

/* mock a API alert object, embedded in Alert Rule API object */
export const AlertFactory = Factory.define<AlertInstance>(() => {
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
export const AlertingRuleDefinitionFactory = Factory.define<AlertingRuleDefinition>(({ sequence }) => {
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
  } satisfies AlertingRuleDefinition;
});

/* mock a API recording rule object */
export const RecordingRuleFactory = Factory.define<RecordingRule>(({ sequence }) => {
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
export const RecordingRuleDefinitionFactory = Factory.define<RecordingRuleDefinition>(({ sequence }) => {
  return {
    record: `Recording Rule #${sequence}`,
    expr: 'vector(1)',
    labels: {
      label1: 'value1',
      label2: 'value2',
    },
  } satisfies RecordingRuleDefinition;
});

/* mock a RuleGroup API object */
export const RuleGroupFactory = Factory.define<RuleGroup>(({ sequence }) => {
  return {
    name: `Rule Group #${sequence}`,
    file: 'default',
    // 1 recording rule + 2 alerting rules
    rules: [RecordingRuleFactory.build(), ...AlertingRuleFactory.buildList(2)],
    interval: 60,
    evaluationTime: evaluationTime(),
    lastEvaluation: new Date().toISOString(),
  } satisfies RuleGroup;
});

/* mock a YAML RuleGroup definition */
export const RuleGroupDefinitionFactory = Factory.define<RuleGroupDefinition>(({ sequence }) => {
  return {
    name: `Rule Group #${sequence}`,
    limit: 0,
    interval: '1m',
    labels: {
      label1: 'value1',
      label2: 'value2',
    },
    // 1 recording rule + 2 alerting rules
    rules: [RecordingRuleDefinitionFactory.build(), ...AlertingRuleDefinitionFactory.buildList(2)],
  } satisfies RuleGroupDefinition;
});

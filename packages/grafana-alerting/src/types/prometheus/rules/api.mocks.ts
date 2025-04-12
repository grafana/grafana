import { randomLogNormal } from 'd3-random';
import { Factory } from 'fishery';

import { AlertInstance, AlertingRule, RecordingRule, RuleGroup } from './api';

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
    duration: 60, // equivalent to "1m"
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

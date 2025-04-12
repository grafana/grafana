import { Factory } from 'fishery';

import { AlertingRuleDefinition, RecordingRuleDefinition, RuleGroupDefinition } from './definitions';

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

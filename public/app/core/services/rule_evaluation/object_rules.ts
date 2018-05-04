import _ from 'lodash';
import { RuleDefinition, RuleKind } from './rule_evaluator';

export const empty = (input: any) => {
  if (input === undefined || input === null) {
    return true;
  }

  if (_.isString(input)) {
    return String(input).trim().length === 0;
  }

  if (_.isFinite(input)) {
    return Number(input) === undefined;
  }

  return _.isEmpty(input);
};

export const notEmpty = (input: any) => {
  return !empty(input);
};

const rules = {
  is_empty: { desc: 'Value is empty', evaluate: empty },
  is_not_empty: { desc: 'Value is not empty', evaluate: notEmpty },
};

export const getObjectRules = (): RuleDefinition[] => {
  return Object.keys(rules).map(name => {
    const rule = rules[name];
    return {
      name,
      description: rule.desc,
      kind: RuleKind.Object,
      evaluate: rule.evaluate,
    };
  });
};

export default getObjectRules;

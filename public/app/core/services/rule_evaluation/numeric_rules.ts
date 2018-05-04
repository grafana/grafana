import _ from 'lodash';
import { RuleDefinition, RuleKind } from './rule_evaluator';

export const wrap = (expectedParams, evaluate) => {
  return (input: any, conditionParams: any[]) => {
    if (!_.isFinite(input)) {
      return false;
    }

    const params: number[] = [];

    for (let n = 0; n < expectedParams; n++) {
      const condParam = conditionParams[n];

      if (!_.isFinite(condParam)) {
        return false;
      }

      params[n] = Number(condParam);
    }

    if (params.length !== expectedParams) {
      return false;
    }

    return evaluate(Number(input), ...params);
  };
};

export const greaterThan = (input: number, compare: number) => {
  return input > compare;
};

export const greaterThanOrEqual = (input: number, compare: number) => {
  return input >= compare;
};

export const lessThan = (input: number, compare: number) => {
  return !greaterThanOrEqual(input, compare);
};

export const lessThanOrEqual = (input: number, compare: number) => {
  return !greaterThan(input, compare);
};

export const equal = (input: number, compare: number) => {
  return input === compare;
};

export const notEqual = (input: number, compare: number) => {
  return !equal(input, compare);
};

export const withinRange = (input: number, min: number, max: number) => {
  return greaterThanOrEqual(input, min) && lessThanOrEqual(input, max);
};

export const outsideRange = (input: number, min: number, max: number) => {
  return !withinRange(input, min, max);
};

const rules = {
  gt: { desc: 'Greater than', evaluate: wrap(1, greaterThan) },
  gte: { desc: 'Greater than or equal', evaluate: wrap(1, greaterThanOrEqual) },
  lt: { desc: 'Less than', evaluate: wrap(1, lessThan) },
  lte: { desc: 'Less than or equal', evaluate: wrap(1, lessThanOrEqual) },
  eq: { desc: 'Is equal to', evaluate: wrap(1, equal) },
  neq: { desc: 'Is not equal to', evaluate: wrap(1, notEqual) },
  within_range: { desc: 'Is between', evaluate: wrap(2, withinRange) },
  outside_range: { desc: 'Is not between', evaluate: wrap(2, outsideRange) },
};

export const getNumericRules = (): RuleDefinition[] => {
  return Object.keys(rules).map(name => {
    const rule = rules[name];
    return {
      name,
      description: rule.desc,
      kind: RuleKind.Numeric,
      evaluate: rule.evaluate,
    };
  });
};

export default getNumericRules;

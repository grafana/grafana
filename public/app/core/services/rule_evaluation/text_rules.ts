import _ from 'lodash';
import { RuleDefinition, RuleKind } from './rule_evaluator';
import kbn from 'app/core/utils/kbn';

export const wrap = (expectedParams, evaluate) => {
  return (input: any, conditionParams: any[]) => {
    if (!_.isString(input)) {
      return false;
    }

    const params: string[] = [];

    for (let n = 0; n < expectedParams; n++) {
      const condParam = conditionParams[n];

      if (!_.isString(condParam)) {
        return false;
      }

      params[n] = String(condParam).trim();
    }

    if (params.length !== expectedParams) {
      return false;
    }

    input = String(input).trim();

    return evaluate(String(input), ...params);
  };
};

export const contains = (input: string, searchOrRegex: string) => {
  if (searchOrRegex.startsWith('/') && searchOrRegex.endsWith('/')) {
    const regex = kbn.stringToJsRegex(searchOrRegex);
    return regex.exec(input);
  }

  return input.indexOf(searchOrRegex) !== -1;
};

export const notContains = (input: string, searchOrRegex: string) => {
  return !contains(input, searchOrRegex);
};

export const startsWith = (input: string, prefix: string) => {
  return input.startsWith(prefix);
};

export const endsWith = (input: string, postfix: string) => {
  return input.endsWith(postfix);
};

export const isExactly = (input: string, compare: string) => {
  return input === compare;
};

const rules = {
  contains: { desc: 'Text contains', evaluate: wrap(1, contains) },
  not_contains: { desc: 'Text does not contains', evaluate: wrap(1, notContains) },
  starts_with: { desc: 'Text starts with', evaluate: wrap(1, startsWith) },
  ends_with: { desc: 'Text ends with', evaluate: wrap(1, endsWith) },
  is_exactly: { desc: 'Text is exactly', evaluate: wrap(1, isExactly) },
};

export const getTextRules = (): RuleDefinition[] => {
  return Object.keys(rules).map(name => {
    const rule = rules[name];
    return {
      name,
      description: rule.desc,
      kind: RuleKind.Text,
      evaluate: rule.evaluate,
    };
  });
};

export default getTextRules;

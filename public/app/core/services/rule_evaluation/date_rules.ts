import { RuleDefinition, RuleKind } from './rule_evaluator';
import moment from 'moment';
import * as dateMath from 'app/core/utils/datemath';

export const wrap = evaluate => {
  return (input: any, conditionParams: any[]) => {
    if (!input || conditionParams.length < 3) {
      return false;
    }

    const timezone = conditionParams[2];
    const from = dateMath.parse(conditionParams[0], false, timezone);
    const to = dateMath.parse(conditionParams[1], true, timezone);

    if (from === undefined || to === undefined) {
      return false;
    }

    const d = moment(input);

    return evaluate(d, from, to);
  };
};

export const is = (input: moment.Moment, from: moment.Moment, to: moment.Moment) => {
  if (from.valueOf() === to.valueOf()) {
    return input.valueOf() === from.valueOf();
  }

  return input.isBetween(from, to);
};

export const isBefore = (input: moment.Moment, from: moment.Moment, to: moment.Moment) => {
  return input.isBefore(from);
};

export const isAfter = (input: moment.Moment, from: moment.Moment, to: moment.Moment) => {
  return input.isAfter(to);
};

const rules = {
  date_is: { desc: 'Date is', evaluate: wrap(is) },
  date_is_before: { desc: 'Date is before', evaluate: wrap(isBefore) },
  date_is_after: { desc: 'Date is after', evaluate: wrap(isAfter) },
};

export const getDateRules = (): RuleDefinition[] => {
  return Object.keys(rules).map(name => {
    const rule = rules[name];
    return {
      name,
      description: rule.desc,
      kind: RuleKind.Date,
      evaluate: rule.evaluate,
    };
  });
};

export default getDateRules;

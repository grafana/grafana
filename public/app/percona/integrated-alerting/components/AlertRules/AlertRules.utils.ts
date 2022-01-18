import moment from 'moment/moment';
import {
  AlertRule,
  AlertRuleFilterType,
  AlertRuleSeverity,
  AlertRulesListPayloadFilter,
  AlertRulesListResponseRule,
  AlertRulesParsedParam,
} from './AlertRules.types';

export const formatFilter = (filter: AlertRulesListPayloadFilter): string => {
  const { key, type, value } = filter;

  return `${key}${AlertRuleFilterType[type]}${value}`;
};

export const formatDuration = (duration: string): string => {
  const seconds = parseInt(duration, 10);

  // NOTE: this is needed because the `humanize` function by moment.js returns 'a few seconds' for < ~50 secs
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  // TODO: when switching to moment.js v2.25, add thresholds to the `humanize` function,
  //       making it more precise. Right now it's just approximating:
  //       3000 (seconds, which is 50 minutes) will result in 'a minute';
  return moment.duration(seconds, 'seconds').humanize();
};

export const formatRule = (rule: AlertRulesListResponseRule): AlertRule => {
  const {
    rule_id,
    created_at,
    disabled,
    filters,
    for: duration,
    last_notified,
    severity,
    name,
    expr,
    params_definitions,
    params_values = [],
  } = rule;
  const resultParams: AlertRulesParsedParam[] = [];

  params_values.forEach(({ name, type, ...rest }) => {
    const matchingTemplateParam = params_definitions.find((param) => param.name === name);

    if (matchingTemplateParam) {
      resultParams.push({
        ...matchingTemplateParam,
        value: Object.values(rest).find((value) => value !== undefined),
      });
    }
  });

  return {
    ruleId: rule_id,
    createdAt: moment(created_at).format('YYYY-MM-DD HH:mm:ss.SSS'),
    disabled,
    duration: formatDuration(duration),
    filters: filters ? filters.map(formatFilter) : [],
    severity: AlertRuleSeverity[severity],
    name,
    lastNotified: last_notified ? moment(last_notified).format('YYYY-MM-DD HH:mm:ss.SSS') : '',
    rawValues: rule,
    params: resultParams,
    expr,
  };
};

export const formatRules = (rules: AlertRulesListResponseRule[] | null | undefined): AlertRule[] =>
  rules ? rules.map(formatRule) : [];

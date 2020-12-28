import moment from 'moment/moment';
import {
  AlertRule,
  AlertRuleFilterType,
  AlertRuleParamType,
  AlertRuleSeverity,
  AlertRulesListPayloadFilter,
  AlertRulesListResponseRule,
  AlertRulesListResponseParam,
  AlertRulesListPayloadTemplate,
  AlertRulesListPayloadTemplateParamUnits,
} from './AlertRules.types';

export const formatFilter = (filter: AlertRulesListPayloadFilter): string => {
  const { key, type, value } = filter;

  return `${key}${AlertRuleFilterType[type]}${value}`;
};

export const formatThreshold = (
  template: AlertRulesListPayloadTemplate,
  params: AlertRulesListResponseParam[] | undefined
): string => {
  const templateThresholdParam = template?.params?.find(param => param.name === 'threshold');
  const thresholdParam = params?.find(param => param.name === 'threshold');

  if (!templateThresholdParam) {
    return '';
  }

  const { unit: paramUnit } = templateThresholdParam;
  const { type: paramType } = thresholdParam ?? templateThresholdParam;
  const type = AlertRuleParamType[paramType];

  if (type === AlertRuleParamType.PARAM_TYPE_INVALID) {
    return 'Invalid type';
  }

  let value: boolean | number | string;

  if (!thresholdParam) {
    value = templateThresholdParam[type].default;
  } else {
    value = thresholdParam[type];
  }

  const unit = AlertRulesListPayloadTemplateParamUnits[paramUnit];

  return `${value}${unit ? ` ${unit}` : ''}`;
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
    template,
    severity,
    summary,
    params,
  } = rule;

  return {
    ruleId: rule_id,
    createdAt: moment(created_at).format('YYYY-MM-DD HH:mm:ss.SSS'),
    disabled,
    duration: formatDuration(duration),
    filters: filters ? filters.map(formatFilter) : [],
    severity: AlertRuleSeverity[severity],
    summary,
    threshold: formatThreshold(template, params),
    lastNotified: last_notified ? moment(last_notified).format('YYYY-MM-DD HH:mm:ss.SSS') : '',
    rawValues: rule,
  };
};

export const formatRules = (rules: AlertRulesListResponseRule[]): AlertRule[] => (rules ? rules.map(formatRule) : []);

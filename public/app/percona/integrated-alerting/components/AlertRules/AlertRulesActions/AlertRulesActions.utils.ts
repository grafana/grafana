import { AlertRule, AlertRuleCopyPayload, AlertRulesListResponseParam } from '../AlertRules.types';
import { Messages } from './AlertRulesActions.messages';

export const createAlertRuleCopyPayload = (rule: AlertRule): AlertRuleCopyPayload => {
  const { rawValues, name } = rule;
  const {
    channels,
    custom_labels,
    filters,
    for: ruleFor,
    severity,
    params_definitions = [],
    params_values = [],
    rule_id,
  } = rawValues;

  const newName = `${Messages.copyOf} ${name}`;

  const payload: AlertRuleCopyPayload = {
    channel_ids: channels?.map((channel) => channel.channel_id),
    custom_labels,
    disabled: true,
    name: newName,
    filters,
    for: ruleFor,
    severity,
    source_rule_id: rule_id,
  };
  const params: AlertRulesListResponseParam[] = [];

  params_definitions.forEach(({ name }) => {
    const matchingParam = params_values?.find((param) => param.name === name);

    if (matchingParam) {
      params.push(matchingParam);
    }
  });

  return { ...payload, params };
};

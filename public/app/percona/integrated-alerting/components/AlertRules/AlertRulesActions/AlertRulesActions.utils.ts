import { AlertRule, AlertRuleCreatePayload, AlertRulesListResponseParam } from '../AlertRules.types';
import { Messages } from './AlertRulesActions.messages';

export const createAlertRuleCopyPayload = (rule: AlertRule): AlertRuleCreatePayload => {
  const { rawValues, name } = rule;
  const {
    channels,
    custom_labels,
    template_name,
    filters,
    for: ruleFor,
    severity,
    params_definitions,
    params_values,
  } = rawValues;

  const newName = `${Messages.copyOf} ${name}`;

  const payload: AlertRuleCreatePayload = {
    channel_ids: channels?.map((channel) => channel.channel_id),
    custom_labels,
    template_name,
    disabled: true,
    name: newName,
    filters,
    for: ruleFor,
    severity,
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

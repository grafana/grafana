import { AddAlertRuleFormValues, Severity } from './AddAlertRuleModal.types';
import {
  AlertRule,
  AlertRuleParamType,
  AlertRuleCreatePayload,
  AlertRuleUpdatePayload,
  AlertRulesListPayloadFilter,
  AlertRuleFilterType,
  AlertRulesListResponseParam,
  AlertRulesListPayloadTemplate,
  AlertRulesListResponseChannel,
} from '../AlertRules.types';
import { NotificationChannel } from '../../NotificationChannel/NotificationChannel.types';
import { Template } from '../../AlertRuleTemplate/AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';
import { SelectableValue } from '@grafana/data';
import { Messages } from './AddAlertRuleModal.messages';

export const formatChannelsOptions = (channels: NotificationChannel[]): Array<SelectableValue<string>> =>
  channels
    ? channels.map(channel => ({
        value: channel.channelId,
        label: channel.summary,
      }))
    : [];

export const formatTemplateOptions = (templates: Template[]): Array<SelectableValue<string>> =>
  templates
    ? templates.map(template => ({
        value: template.name,
        label: template.summary,
      }))
    : [];

// TODO: handle new types as they gets added to AlertRuleFilterType
export const formatFilter = (filter: string): AlertRulesListPayloadFilter => {
  if (!filter) {
    return {
      key: '',
      value: '',
      type: 'EQUAL',
    };
  }

  const [key, value] = filter.split('=');

  return {
    key,
    value,
    type: 'EQUAL',
  };
};

export const formatFilters = (filters: string): AlertRulesListPayloadFilter[] => {
  const trimmedFilters = filters.trim();

  if (trimmedFilters === '') {
    return [];
  }

  const filterList = trimmedFilters.split(/,\s*/);

  return filterList.map(formatFilter);
};

export const formatBooleanThreshold = (value: string): AlertRulesListResponseParam => {
  return {
    name: 'threshold',
    type: 'BOOL',
    bool: value.toLowerCase() === 'true',
  };
};

export const formatFloatThreshold = (value: string): AlertRulesListResponseParam => {
  return {
    name: 'threshold',
    type: 'FLOAT',
    float: parseFloat(value),
  };
};

export const formatStringThreshold = (value: string): AlertRulesListResponseParam => {
  return {
    name: 'threshold',
    type: 'STRING',
    string: value,
  };
};

export const formatThreshold = (value: string): AlertRulesListResponseParam => {
  if (/^true|false$/i.test(value)) {
    return formatBooleanThreshold(value);
  } else if (/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(value)) {
    return formatFloatThreshold(value);
  } else {
    return formatStringThreshold(value);
  }
};

export const formatCreateAPIPayload = (data: AddAlertRuleFormValues): AlertRuleCreatePayload => {
  const { enabled, duration, filters, name, notificationChannels, severity, template, threshold } = data;

  const payload: AlertRuleCreatePayload = {
    custom_labels: {},
    disabled: !enabled,
    channel_ids: notificationChannels ? notificationChannels.map(channel => channel.value) : [],
    filters: filters ? formatFilters(filters) : [],
    for: `${duration}s`,
    severity: severity.value,
    template_name: template.value,
    summary: name,
  };

  const trimmedThreshold = threshold?.trim();

  if (trimmedThreshold) {
    payload.params = [formatThreshold(trimmedThreshold)];
  }

  return payload;
};

export const formatUpdateAPIPayload = (ruleId: string, data: AddAlertRuleFormValues): AlertRuleUpdatePayload => {
  const payload = formatCreateAPIPayload(data);

  return {
    ...payload,
    rule_id: ruleId,
  };
};

export const formatEditFilter = (filter: AlertRulesListPayloadFilter): string => {
  const { key, type, value } = filter;

  return `${key}${AlertRuleFilterType[type]}${value}`;
};

export const formatEditFilters = (filters: AlertRulesListPayloadFilter[]): string => {
  return filters ? filters.map(formatEditFilter).join(', ') : '';
};

export const formatEditTemplate = (template: AlertRulesListPayloadTemplate): SelectableValue<string> => ({
  value: template.name,
  label: template.summary,
});

export const formatEditSeverity = (severity: keyof typeof Severity): SelectableValue<Severity> => ({
  value: Severity[severity],
  label: Messages.severities[severity],
});

export const formatEditNotificationChannel = (channel: AlertRulesListResponseChannel) => ({
  value: channel.channel_id,
  label: channel.summary,
});

export const formatEditNotificationChannels = (
  channels: AlertRulesListResponseChannel[]
): Array<SelectableValue<string>> => (channels ? channels.map(formatEditNotificationChannel) : []);

export const formatEditThreshold = (params: AlertRulesListResponseParam[]): string | null => {
  const thresholdParam = params?.find(param => param.name === 'threshold');

  if (!thresholdParam) {
    return null;
  }

  const paramType = thresholdParam.type;
  const type = AlertRuleParamType[paramType];

  if (type === AlertRuleParamType.PARAM_TYPE_INVALID) {
    return null;
  }

  return `${thresholdParam[type]}`;
};

export const getInitialValues = (alertRule: AlertRule): AddAlertRuleFormValues => {
  if (!alertRule) {
    return undefined;
  }

  const { channels, disabled, filters, for: duration, template, severity, summary, params } = alertRule.rawValues;

  return {
    enabled: !disabled,
    duration: parseInt(duration, 10),
    filters: formatEditFilters(filters),
    name: summary,
    notificationChannels: formatEditNotificationChannels(channels),
    severity: formatEditSeverity(severity),
    template: formatEditTemplate(template),
    threshold: formatEditThreshold(params),
  };
};

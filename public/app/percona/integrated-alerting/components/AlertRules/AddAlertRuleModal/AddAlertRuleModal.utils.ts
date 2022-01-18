import { AddAlertRuleFormValues } from './AddAlertRuleModal.types';
import {
  AlertRule,
  AlertRuleParamType,
  AlertRuleCreatePayload,
  AlertRuleUpdatePayload,
  AlertRulesListPayloadFilter,
  AlertRuleFilterType,
  AlertRulesListResponseChannel,
} from '../AlertRules.types';
import { NotificationChannel } from '../../NotificationChannel/NotificationChannel.types';
import { Severity, Template, TemplateParam } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { SelectableValue } from '@grafana/data';
import { Messages } from './AddAlertRuleModal.messages';

export const formatChannelsOptions = (channels: NotificationChannel[]): Array<SelectableValue<string>> =>
  channels
    ? channels.map((channel) => ({
        value: channel.channelId,
        label: channel.summary,
      }))
    : [];

export const formatTemplateOptions = (templates: Template[]): Array<SelectableValue<string>> =>
  templates
    ? templates.map((template) => ({
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

export const formatCreateAPIPayload = (
  data: AddAlertRuleFormValues,
  params: TemplateParam[] = []
): AlertRuleCreatePayload => {
  const { enabled, duration, filters, name, notificationChannels, severity, template } = data;

  const payload: AlertRuleCreatePayload = {
    custom_labels: {},
    disabled: !enabled,
    channel_ids: notificationChannels ? notificationChannels.map((channel) => channel.value as string) : [],
    filters: filters ? formatFilters(filters) : [],
    for: `${duration}s`,
    severity: severity.value as Severity,
    template_name: template.value as string,
    name,
    params: [],
  };

  params.forEach((param) => {
    if (data.hasOwnProperty(param.name)) {
      const { name, type } = param;
      const value = data[param.name];
      payload.params?.push({
        name,
        type,
        [type.toLowerCase()]: value,
      });
    }
  });

  return payload;
};

export const formatUpdateAPIPayload = (
  ruleId: string,
  data: AddAlertRuleFormValues,
  params: TemplateParam[] = []
): AlertRuleUpdatePayload => {
  const payload = formatCreateAPIPayload(data, params);

  return {
    ...payload,
    rule_id: ruleId,
  };
};

export const formatEditFilter = (filter: AlertRulesListPayloadFilter): string => {
  const { key, type, value } = filter;

  return `${key}${AlertRuleFilterType[type]}${value}`;
};

export const formatEditFilters = (filters: AlertRulesListPayloadFilter[] | undefined | null): string => {
  return filters ? filters.map(formatEditFilter).join(', ') : '';
};

export const formatEditTemplate = (templateName: string, templateSummary: string): SelectableValue<string> => ({
  value: templateName,
  label: templateSummary,
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

export const getInitialValues = (alertRule?: AlertRule | null): AddAlertRuleFormValues | undefined => {
  if (!alertRule) {
    return undefined;
  }

  const {
    channels,
    disabled,
    filters,
    for: duration,
    severity,
    name,
    params_values,
    template_name,
    summary,
  } = alertRule.rawValues;
  const result: AddAlertRuleFormValues = {
    enabled: !disabled,
    duration: parseInt(duration, 10),
    filters: formatEditFilters(filters),
    name,
    notificationChannels: formatEditNotificationChannels(channels),
    severity: formatEditSeverity(severity),
    template: formatEditTemplate(template_name, summary),
  };

  params_values?.forEach((param) => {
    const { float, type } = param;
    const typeMap: Record<keyof typeof AlertRuleParamType, any> = {
      FLOAT: float,
      BOOL: undefined,
      STRING: undefined,
    };
    result[param.name] = typeMap[type];
  });
  return result;
};

export const minValidator = (min: number) => (value: any): undefined | string =>
  value >= min ? undefined : `Must be greater than or equal to ${min}`;

export const maxValidator = (max: number) => (value: any): undefined | string =>
  value <= max ? undefined : `Must be less than or equal to ${max}`;

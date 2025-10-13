import { durationToMilliseconds, parseDuration, SelectableValue } from '@grafana/data';
import { Template } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRuleCreatePayload, AlertRulesListResponseChannel, Severity } from 'app/percona/shared/core';

import { TemplatedAlertFormValues } from '../../types';

import { TYPE_TO_KEY_MAP } from './TemplateForm.constants';

export const formatChannelsOptions = (channels: string[]): Array<SelectableValue<string>> =>
  channels
    ? channels.map((channel) => ({
        value: channel,
        label: channel,
      }))
    : [];

export const formatTemplateOptions = (templates: Template[]): Array<SelectableValue<Template>> =>
  templates
    ? templates.map((template) => ({
        value: template,
        label: template.summary,
      }))
    : [];

export const formatCreateAPIPayload = (data: TemplatedAlertFormValues): AlertRuleCreatePayload => {
  const { duration, filters, ruleName, severity, template, folder, group, evaluateEvery } = data;
  const durationObj = parseDuration(duration);
  const durationSeconds = durationToMilliseconds(durationObj) / 1000;
  const intervalObj = parseDuration(evaluateEvery);
  const intervalSeconds = durationToMilliseconds(intervalObj) / 1000;

  const payload: AlertRuleCreatePayload = {
    custom_labels: {},
    filters: filters || [],
    for: `${durationSeconds}s`,
    interval: `${intervalSeconds}s`,
    severity: severity!,
    template_name: template?.name!,
    name: ruleName,
    params: [],
    group,
    folder_uid: folder?.uid || '',
  };

  template?.params?.forEach((param) => {
    if (data.hasOwnProperty(param.name)) {
      const { name, type } = param;
      // @ts-ignore
      const value = data[param.name];
      payload.params?.push({
        name,
        type,
        [TYPE_TO_KEY_MAP[type]]: value,
      });
    }
  });

  return payload;
};

export const formatEditTemplate = (templateName: string, templateSummary: string): SelectableValue<string> => ({
  value: templateName,
  label: templateSummary,
});

export const formatEditSeverity = (severity: keyof typeof Severity): SelectableValue<keyof typeof Severity> => ({
  value: severity,
  label: Severity[severity],
});

export const formatEditNotificationChannel = (channel: AlertRulesListResponseChannel) => ({
  value: channel.channel_id,
  label: channel.summary,
});

export const formatEditNotificationChannels = (
  channels: AlertRulesListResponseChannel[]
): Array<SelectableValue<string>> => (channels ? channels.map(formatEditNotificationChannel) : []);

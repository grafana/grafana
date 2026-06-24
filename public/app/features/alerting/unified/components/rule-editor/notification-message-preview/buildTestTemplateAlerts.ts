import { type PreviewResponse } from '../../../api/alertRuleApi';
import { type TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

export function previewResponseToTestTemplateAlert(instance: PreviewResponse[number]): TestTemplateAlert {
  return {
    status: 'firing',
    labels: instance.labels ?? {},
    annotations: instance.annotations ?? {},
    startsAt: instance.startsAt,
    endsAt: instance.endsAt,
    generatorURL: instance.generatorURL,
    fingerprint: 'notification-message-preview',
  };
}

export function buildTestTemplateAlerts({
  ruleName,
  annotations,
  labels,
  previewInstances,
}: {
  ruleName: string;
  annotations: Record<string, string>;
  labels: Record<string, string>;
  previewInstances?: PreviewResponse;
}): TestTemplateAlert[] {
  const previewInstance = previewInstances?.find((instance) => instance.labels);
  const now = new Date();

  const mergedLabels = {
    ...(previewInstance?.labels ?? {}),
    alertname: ruleName.trim() || previewInstance?.labels?.alertname || 'Untitled alert',
    ...labels,
  };

  const mergedAnnotations = {
    ...annotations,
    ...(previewInstance?.annotations ?? {}),
  };

  if (previewInstance) {
    return [
      {
        ...previewResponseToTestTemplateAlert(previewInstance),
        status: 'firing',
        labels: mergedLabels,
        annotations: mergedAnnotations,
      },
    ];
  }

  return [
    {
      status: 'firing',
      labels: mergedLabels,
      annotations: mergedAnnotations,
      startsAt: now.toISOString(),
      endsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      fingerprint: 'notification-message-preview',
    },
  ];
}

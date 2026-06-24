import { type ReceiverIntegration } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

export interface IntegrationPreviewTemplates {
  integrationType: string;
  integrationLabel: string;
  titleTemplate: string;
  bodyTemplate: string;
  previewMayDifferFromDelivery: boolean;
}

const DEFAULT_TITLE = '{{ template "default.title" . }}';
const DEFAULT_MESSAGE = '{{ template "default.message" . }}';
const SLACK_DEFAULT_TITLE = '{{ template "slack.default.title" . }}';
const SLACK_DEFAULT_TEXT = '{{ template "slack.default.text" . }}';

function readSetting(settings: Record<string, unknown>, key: string): string | undefined {
  const value = settings[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getIntegrationMetadata(type: string): Pick<IntegrationPreviewTemplates, 'integrationLabel' | 'previewMayDifferFromDelivery'> {
  switch (type) {
    case 'oncall':
      return {
        integrationLabel: 'Grafana IRM',
        previewMayDifferFromDelivery: true,
      };
    default:
      return {
        integrationLabel: type,
        previewMayDifferFromDelivery: false,
      };
  }
}

export function getIntegrationPreviewTemplates(integration: ReceiverIntegration): IntegrationPreviewTemplates {
  const settings = (integration.settings ?? {}) as Record<string, unknown>;
  const metadata = getIntegrationMetadata(integration.type);

  switch (integration.type) {
    case 'slack':
      return {
        ...metadata,
        integrationType: 'slack',
        titleTemplate: readSetting(settings, 'title') ?? SLACK_DEFAULT_TITLE,
        bodyTemplate: readSetting(settings, 'text') ?? SLACK_DEFAULT_TEXT,
      };
    case 'email':
      return {
        ...metadata,
        integrationType: 'email',
        titleTemplate: readSetting(settings, 'subject') ?? DEFAULT_TITLE,
        bodyTemplate: readSetting(settings, 'message') ?? DEFAULT_MESSAGE,
      };
    default: {
      const genericSettings = settings as Record<string, unknown>;
      return {
        ...metadata,
        integrationType: integration.type,
        titleTemplate: readSetting(genericSettings, 'title') ?? readSetting(genericSettings, 'subject') ?? DEFAULT_TITLE,
        bodyTemplate:
          readSetting(genericSettings, 'message') ??
          readSetting(genericSettings, 'text') ??
          readSetting(genericSettings, 'body') ??
          DEFAULT_MESSAGE,
      };
    }
  }
}

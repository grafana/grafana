import { DEFAULT_TEMPLATES } from '../../../utils/template-constants';

import { type IntegrationPreviewTemplates } from './getIntegrationPreviewTemplates';

export const PREVIEW_TITLE_TEMPLATE = 'notification-message-preview.title';
export const PREVIEW_BODY_TEMPLATE = 'notification-message-preview.body';

export function buildContactPointPreviewTemplate(templates: IntegrationPreviewTemplates): string {
  return `${DEFAULT_TEMPLATES}
{{ define "${PREVIEW_TITLE_TEMPLATE}" }}
${templates.titleTemplate}
{{ end }}
{{ define "${PREVIEW_BODY_TEMPLATE}" }}
${templates.bodyTemplate}
{{ end }}`;
}

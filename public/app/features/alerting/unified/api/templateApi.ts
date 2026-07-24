import { type TemplateGroupTemplateKind } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { alertingApi } from 'app/features/alerting/unified/api/alertingApi';
import { type Template } from 'app/features/alerting/unified/components/receivers/form/fields/TemplateSelector';
import { DEFAULT_TEMPLATES } from 'app/features/alerting/unified/utils/template-constants';

import { parseTemplates } from '../components/receivers/form/fields/utils';

export const previewTemplateUrl = `/api/alertmanager/grafana/config/api/v1/templates/test`;

export interface TemplatePreviewResult {
  name: string;
  text: string;
}
export interface TemplatePreviewErrors {
  name?: string;
  message: string;
  kind: string;
}
export interface TemplatePreviewResponse {
  results?: TemplatePreviewResult[];
  errors?: TemplatePreviewErrors[];
}

export interface KeyValueField {
  key: string;
  value: string;
}
export interface AlertField {
  annotations: KeyValueField[];
  labels: KeyValueField[];
}

export type TemplatesTestPayload = {
  template: string;
  alerts: AlertField[];
  name: string;
  kind?: TemplateGroupTemplateKind;
};

export const templatesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    previewTemplate: build.mutation<TemplatePreviewResponse, TemplatesTestPayload>({
      query: ({ template, alerts, name, kind }) => ({
        url: previewTemplateUrl,
        data: { template, alerts, name, kind },
        method: 'POST',
      }),
    }),
    getDefaultTemplates: build.query<Template[], void>({
      queryFn: async () => {
        const data = parseTemplates(DEFAULT_TEMPLATES);
        return { data };
      },
    }),
  }),
});

export const { usePreviewTemplateMutation } = templatesApi;

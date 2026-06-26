import { AlertingApiExtraOptions } from 'app/features/alerting/unified/api/alertingApi';
import { Template } from 'app/features/alerting/unified/components/receivers/form/fields/TemplateSelector';
import { DEFAULT_TEMPLATES } from 'app/features/alerting/unified/utils/template-constants';

import { parseTemplates } from '../components/receivers/form/fields/utils';
import { generatedTemplatesApi } from '../openapi/templatesApi.gen';

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

generatedTemplatesApi.enhanceEndpoints({
  endpoints: {
    readNamespacedTemplateGroup: (endpoint) => {
      // When renaming a template, we end up refetching,
      // and we would otherwise see a "NotFound" message. We suppress this to avoid confusion in the UI
      const extraOptions: AlertingApiExtraOptions = { hideErrorMessage: true };
      endpoint.extraOptions = extraOptions;
    },
  },
});

export type TemplatesTestPayload = { template: string; alerts: AlertField[]; name: string };

export const templatesApi = generatedTemplatesApi.injectEndpoints({
  endpoints: (build) => ({
    previewTemplate: build.mutation<TemplatePreviewResponse, TemplatesTestPayload>({
      query: ({ template, alerts, name }) => ({
        url: previewTemplateUrl,
        data: { template: template, alerts: alerts, name: name },
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

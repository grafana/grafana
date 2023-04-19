import { alertingApi } from './alertingApi';

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
export interface TemplatesPreviewResponse {
  results?: TemplatePreviewResult[];
  errors?: TemplatePreviewErrors[];
}

type AnnoField = {
  key: string;
  value: string;
};
export interface AlertFields {
  annotations: AnnoField[];
  labels: AnnoField[];
}

export const templatesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    previewPayload: build.mutation<TemplatesPreviewResponse, { template: string; payload: AlertFields[] }>({
      query: ({ template, payload }) => ({
        url: previewTemplateUrl,
        data: { template: template, data: payload },
        method: 'POST',
      }),
    }),
  }),
});

export const { usePreviewPayloadMutation } = templatesApi;

import { alertingApi } from './alertingApi';

export const defaultPayloadUrl = `/api/templates/default`;
export const previewTemplateUrl = `/api/templates/preview`;

export interface TemplatePreviewResult {
  name: string;
  text: string;
}
export interface TemplatePreviewErrors {
  name: string;
  error: string;
}
export interface TemplatesPreviewResponse {
  results?: TemplatePreviewResult[];
  errors?: TemplatePreviewErrors[];
}

export interface TemplateDefaultPayloadResponse {
  defaultPayload: string;
}

export const templatesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    defaultPayload: build.query<TemplateDefaultPayloadResponse, void>({
      query: () => ({ url: defaultPayloadUrl }),
    }),
    previewPayload: build.mutation<TemplatesPreviewResponse, { template: string; payload: string }>({
      query: ({ template, payload }) => ({
        url: previewTemplateUrl,
        data: { template: template, data: payload },
        method: 'POST',
      }),
    }),
  }),
});

export const { useDefaultPayloadQuery, usePreviewPayloadMutation } = templatesApi;

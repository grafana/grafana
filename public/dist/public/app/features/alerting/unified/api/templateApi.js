import { alertingApi } from './alertingApi';
export const previewTemplateUrl = `/api/alertmanager/grafana/config/api/v1/templates/test`;
export const templatesApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        previewTemplate: build.mutation({
            query: ({ template, alerts, name }) => ({
                url: previewTemplateUrl,
                data: { template: template, alerts: alerts, name: name },
                method: 'POST',
            }),
        }),
    }),
});
export const { usePreviewTemplateMutation } = templatesApi;
//# sourceMappingURL=templateApi.js.map
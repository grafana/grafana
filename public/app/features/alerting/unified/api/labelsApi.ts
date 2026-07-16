import { buildAppPluginResourceUrl } from '@grafana/runtime/internal';

import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

export interface LabelItem {
  id: string;
  name: string;
  prescribed: boolean;
}

export interface LabelKeyAndValues {
  labelKey: LabelItem;
  values: LabelItem[];
}

export const labelsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getLabels: build.query<LabelItem[], void>({
      query: () => ({
        url: buildAppPluginResourceUrl(SupportedPlugin.Labels, '/v2alpha1/labels/keys'),
      }),
      providesTags: ['GrafanaLabels'],
    }),
    getLabelValues: build.query<LabelKeyAndValues, { key: string }>({
      query: ({ key }) => ({
        url: buildAppPluginResourceUrl(SupportedPlugin.Labels, `/v2alpha1/labels/name/${key}`),
      }),
      providesTags: ['GrafanaLabels'],
    }),
  }),
});

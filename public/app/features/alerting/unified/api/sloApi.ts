import { buildAppPluginResourceUrl } from '@grafana/runtime/internal';

import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

interface Label {
  key: string;
  value: string;
}

interface SloAlertingMetadata {
  annotations?: Label[];
  labels?: Label[];
}

interface SloAlerting {
  annotations?: Label[];
  fastBurn?: SloAlertingMetadata;
  labels?: Label[];
  slowBurn?: SloAlertingMetadata;
}

export interface Slo {
  alerting?: SloAlerting;
}

export const sloApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getSlos: build.query<{ slos: Slo[] }, void>({
      query: () => ({
        url: buildAppPluginResourceUrl(SupportedPlugin.Slo, '/v1/slo'),
        showErrorAlert: false,
      }),
      providesTags: ['GrafanaSlo'],
    }),
  }),
});

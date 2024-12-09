import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

export interface Label {
  key: string;
  value: string;
}

export interface SloAlertingMetadata {
  annotations?: Label[];
  labels?: Label[];
}

export interface SloAlerting {
  annotations?: Label[];
  fastBurn?: SloAlertingMetadata;
  labels?: Label[];
  slowBurn?: SloAlertingMetadata;
}

export interface Slo {
  alerting?: SloAlerting;
}

const SLO_API_PATH = `/api/plugins/${SupportedPlugin.Slo}/resources/v1`;

export const sloApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getSlos: build.query<{ slos: Slo[] }, void>({
      query: () => ({ url: `${SLO_API_PATH}/slo`, showErrorAlert: false }),
      providesTags: ['GrafanaSlo'],
    }),
  }),
});

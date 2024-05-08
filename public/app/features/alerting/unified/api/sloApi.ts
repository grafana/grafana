import { FetchError, isFetchError } from '@grafana/runtime';

import { SupportedPlugin } from '../types/pluginBridges';

import { alertingApi } from './alertingApi';

export interface KeyValue {
  key: string;
  value: string;
}

export interface SloAlertingMetadata {
  annotations?: KeyValue[];
  labels?: KeyValue[];
}

export interface SloAlerting {
  annotations?: KeyValue[];
  fastBurn?: SloAlertingMetadata;
  labels?: KeyValue[];
  slowBurn?: SloAlertingMetadata;
}

export interface Slo {
  alerting?: SloAlerting;
}

const SLO_API_PATH = `/api/plugins/${SupportedPlugin.Slo}/resources/v1`;

export const sloApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getSlos: build.query<{ slos: Slo[] }, void>({
      query: () => ({ url: `${SLO_API_PATH}/slo` }),
      providesTags: ['GrafanaSlo'],
    }),
  }),
});

export const { useGetSlosQuery } = sloApi;

export function isSlosFetchError(error: unknown): error is FetchError<{ detail: string }> {
  return isFetchError(error) && 'detail' in error.data;
}

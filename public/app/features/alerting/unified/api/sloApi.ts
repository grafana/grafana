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

interface SloObjective {
  value: number;
  window: string;
}

interface SloDatasourceRef {
  uid?: string;
  type?: string;
}

interface SloReadOnlyStatus {
  type: 'error' | 'creating' | 'created' | 'updated' | 'updating' | 'deleting' | 'unknown';
  message?: string;
}

interface SloReadOnly {
  status?: SloReadOnlyStatus;
}

export interface Slo {
  uuid: string;
  objectives: SloObjective[];
  destinationDatasource?: SloDatasourceRef;
  readOnly?: SloReadOnly;
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

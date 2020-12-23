import { getBackendSrv } from '@grafana/runtime';
import { AlertsListResponse, AlertTogglePayload } from './Alerts.types';

const BASE_URL = `${window.location.origin}/v1/management/ia/Alerts`;

export const AlertsService = {
  async list(): Promise<AlertsListResponse> {
    return getBackendSrv().post(`${BASE_URL}/List`);
  },
  async toggle(payload: AlertTogglePayload): Promise<void> {
    return getBackendSrv().post(`${BASE_URL}/Toggle`, payload);
  },
};

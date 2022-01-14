import { getBackendSrv } from '@grafana/runtime';

const BASE_URL = `${window.location.origin}/v1/Settings`;

export const IntegratedAlertingService = {
  async getSettings() {
    return getBackendSrv().post(`${BASE_URL}/Get`);
  },
};

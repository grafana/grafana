import { api } from 'app/percona/shared/helpers/api';

const BASE_URL = `/v1/Settings`;

export const IntegratedAlertingService = {
  async getSettings(): Promise<any> {
    return api.post(`${BASE_URL}/Get`, {});
  },
};

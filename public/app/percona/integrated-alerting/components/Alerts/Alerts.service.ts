import { api } from 'app/percona/shared/helpers/api';
import { AlertsListResponse, AlertTogglePayload } from './Alerts.types';

const BASE_URL = `/v1/management/ia/Alerts`;

export const AlertsService = {
  async list(): Promise<AlertsListResponse> {
    return api.post(`${BASE_URL}/List`, {});
  },
  async toggle(payload: AlertTogglePayload): Promise<void> {
    return api.post(`${BASE_URL}/Toggle`, payload);
  },
};

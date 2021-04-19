import { api } from 'app/percona/shared/helpers/api';
import { CancelToken } from 'axios';
import { AlertsListResponse, AlertTogglePayload } from './Alerts.types';

const BASE_URL = `/v1/management/ia/Alerts`;

export const AlertsService = {
  async list(token?: CancelToken): Promise<AlertsListResponse> {
    return api.post(`${BASE_URL}/List`, {}, false, token);
  },
  async toggle(payload: AlertTogglePayload, token?: CancelToken): Promise<void> {
    return api.post(`${BASE_URL}/Toggle`, payload, false, token);
  },
};

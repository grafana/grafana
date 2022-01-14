import { api } from 'app/percona/shared/helpers/api';
import { CancelToken } from 'axios';
import { AlertsListResponse, AlertTogglePayload } from './Alerts.types';

const BASE_URL = `/v1/management/ia/Alerts`;

export const AlertsService = {
  async list(pageSize: number, pageIndex: number, token?: CancelToken): Promise<AlertsListResponse> {
    return api.post(
      `${BASE_URL}/List`,
      {
        page_params: {
          page_size: pageSize,
          index: pageIndex,
        },
      },
      false,
      token
    );
  },
  async toggle(payload: AlertTogglePayload, token?: CancelToken): Promise<void> {
    return api.post(`${BASE_URL}/Toggle`, payload, false, token);
  },
};

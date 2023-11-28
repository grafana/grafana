import { AxiosError, CancelToken } from 'axios';

import { FetchError } from '@grafana/runtime';
import { api } from 'app/percona/shared/helpers/api';

import { AlertRuleCreatePayload } from '../../core';

const BASE_URL = `/v1/management/alerting/Rules`;

export const AlertRulesService = {
  async create(payload: AlertRuleCreatePayload, token?: CancelToken, disableNotifications?: boolean): Promise<unknown> {
    return api.post(`${BASE_URL}/Create`, payload, disableNotifications, token).catch((e: AxiosError) => {
      // this call is made within Grafana's code, where they expect this format to properly
      // show the error on the toast
      const fetchErr: FetchError = {
        status: e.response?.status || 400,
        data: e.response?.data,
        config: {
          url: e.config?.url || '',
        },
      };

      throw fetchErr;
    });
  },
};

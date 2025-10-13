import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { AlertRuleCreatePayload } from '../../core';

const BASE_URL = `/v1/alerting/rules`;

export const AlertRulesService = {
  async create(payload: AlertRuleCreatePayload, token?: CancelToken, disableNotifications?: boolean) {
    return api.post(BASE_URL, payload, disableNotifications, token);
  },
};

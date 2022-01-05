import { api } from 'app/percona/shared/helpers/api';
import { CancelToken } from 'axios';
import {
  AlertRulesListResponse,
  AlertRuleCreatePayload,
  AlertRuleTogglePayload,
  AlertRuleDeletePayload,
  AlertRuleCreateResponse,
  AlertRuleGetPayload,
  AlertRuleCopyPayload,
} from './AlertRules.types';

const BASE_URL = `/v1/management/ia/Rules`;

export const AlertRulesService = {
  async list(payload: AlertRuleGetPayload, token?: CancelToken): Promise<AlertRulesListResponse> {
    return api.post(`${BASE_URL}/List`, payload, false, token);
  },
  async create(
    payload: AlertRuleCreatePayload | AlertRuleCopyPayload,
    token?: CancelToken
  ): Promise<AlertRuleCreateResponse> {
    return api.post(`${BASE_URL}/Create`, payload, false, token);
  },
  async update(payload: AlertRuleCreatePayload, token?: CancelToken): Promise<{}> {
    return api.post(`${BASE_URL}/Update`, payload, false, token);
  },
  async toggle(payload: AlertRuleTogglePayload, token?: CancelToken): Promise<void> {
    return api.post(`${BASE_URL}/Toggle`, payload, false, token);
  },
  async delete(payload: AlertRuleDeletePayload, token?: CancelToken): Promise<{}> {
    return api.post(`${BASE_URL}/Delete`, payload, false, token);
  },
};

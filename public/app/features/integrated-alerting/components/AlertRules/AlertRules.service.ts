import { api } from 'app/percona/shared/helpers/api';
import {
  AlertRulesListResponse,
  AlertRuleCreatePayload,
  AlertRuleTogglePayload,
  AlertRuleDeletePayload,
  AlertRuleCreateResponse,
  AlertRuleGetPayload,
} from './AlertRules.types';

const BASE_URL = `/v1/management/ia/Rules`;

export const AlertRulesService = {
  async list(payload: AlertRuleGetPayload): Promise<AlertRulesListResponse> {
    return api.post(`${BASE_URL}/List`, payload);
  },
  async create(payload: AlertRuleCreatePayload): Promise<AlertRuleCreateResponse> {
    return api.post(`${BASE_URL}/Create`, payload);
  },
  async update(payload: AlertRuleCreatePayload): Promise<{}> {
    return api.post(`${BASE_URL}/Update`, payload);
  },
  async toggle(payload: AlertRuleTogglePayload): Promise<void> {
    return api.post(`${BASE_URL}/Toggle`, payload);
  },
  async delete(payload: AlertRuleDeletePayload): Promise<{}> {
    return api.post(`${BASE_URL}/Delete`, payload);
  },
};

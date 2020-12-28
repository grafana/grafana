import { getBackendSrv } from '@grafana/runtime';
import {
  AlertRulesListResponse,
  AlertRuleCreatePayload,
  AlertRuleTogglePayload,
  AlertRuleCreateResponse,
} from './AlertRules.types';

const BASE_URL = `${window.location.origin}/v1/management/ia/Rules`;

export const AlertRulesService = {
  async list(): Promise<AlertRulesListResponse> {
    return getBackendSrv().post(`${BASE_URL}/List`);
  },
  async create(payload: AlertRuleCreatePayload): Promise<AlertRuleCreateResponse> {
    return getBackendSrv().post(`${BASE_URL}/Create`, payload);
  },
  async update(payload: AlertRuleCreatePayload): Promise<{}> {
    return getBackendSrv().post(`${BASE_URL}/Update`, payload);
  },
  async toggle(payload: AlertRuleTogglePayload): Promise<void> {
    return getBackendSrv().post(`${BASE_URL}/Toggle`, payload);
  },
};

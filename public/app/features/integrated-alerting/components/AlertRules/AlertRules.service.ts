import { getBackendSrv } from '@grafana/runtime';
import { AlertRulesListResponse, AlertRuleCreatePayload, AlertRuleCreateResponse } from './AlertRules.types';

const BASE_URL = `${window.location.origin}/v1/management/ia/Rules`;

export const AlertRulesService = {
  async list(): Promise<AlertRulesListResponse> {
    return getBackendSrv().post(`${BASE_URL}/List`);
  },
  async create(payload: AlertRuleCreatePayload): Promise<AlertRuleCreateResponse> {
    return getBackendSrv().post(`${BASE_URL}/Create`, payload);
  },
};

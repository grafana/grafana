import { getBackendSrv } from '@grafana/runtime';
import {
  TemplatesList,
  UploadAlertRuleTemplatePayload,
  UpdateAlertRuleTemplatePayload,
} from './AlertRuleTemplate.types';

const BASE_URL = `${window.location.origin}/v1/management/ia/Templates`;

export const AlertRuleTemplateService = {
  async upload(payload: UploadAlertRuleTemplatePayload): Promise<void> {
    return getBackendSrv().post(`${BASE_URL}/Create`, payload);
  },
  async list(): Promise<TemplatesList> {
    return getBackendSrv().post(`${BASE_URL}/List`, { reload: true });
  },
  async update(payload: UpdateAlertRuleTemplatePayload): Promise<void> {
    return getBackendSrv().post(`${BASE_URL}/Update`, payload);
  },
};

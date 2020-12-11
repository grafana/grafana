import { getBackendSrv } from '@grafana/runtime';
import { UploadAlertRuleTemplatePayload } from './AlertRuleTemplate.types';

const BASE_URL = `${window.location.origin}/v1/management/ia/Templates`;

export const AlertRuleTemplateService = {
  async upload(payload: UploadAlertRuleTemplatePayload): Promise<void> {
    return getBackendSrv().post(`${BASE_URL}/Create`, payload);
  },
};

import { api } from 'app/percona/shared/helpers/api';
import {
  TemplatesList,
  UploadAlertRuleTemplatePayload,
  UpdateAlertRuleTemplatePayload,
  DeleteAlertRuleTemplatePayload,
} from './AlertRuleTemplate.types';

const BASE_URL = `/v1/management/ia/Templates`;

export const AlertRuleTemplateService = {
  async upload(payload: UploadAlertRuleTemplatePayload): Promise<void> {
    return api.post(`${BASE_URL}/Create`, payload);
  },
  async list(): Promise<TemplatesList> {
    return api.post(`${BASE_URL}/List`, { reload: true });
  },
  async update(payload: UpdateAlertRuleTemplatePayload): Promise<void> {
    return api.post(`${BASE_URL}/Update`, payload);
  },
  async delete(payload: DeleteAlertRuleTemplatePayload): Promise<void> {
    return api.post(`${BASE_URL}/Delete`, payload);
  },
};

import { api } from 'app/percona/shared/helpers/api';
import {
  TemplatesList,
  UploadAlertRuleTemplatePayload,
  UpdateAlertRuleTemplatePayload,
  DeleteAlertRuleTemplatePayload,
  AlertRuleTemplateGetPayload,
  TemplatesListAPI,
} from './AlertRuleTemplate.types';

const BASE_URL = `/v1/management/ia/Templates`;

export const AlertRuleTemplateService = {
  async upload(payload: UploadAlertRuleTemplatePayload): Promise<void> {
    return api.post(`${BASE_URL}/Create`, payload);
  },
  async list(payload: AlertRuleTemplateGetPayload): Promise<TemplatesList> {
    return api
      .post<TemplatesListAPI, any>(`${BASE_URL}/List`, { ...payload, reload: true })
      .then(
        ({ totals, templates = [] }): TemplatesList => ({
          totals,
          templates: templates.map(template => ({
            ...template,
            params: template.params?.map(param => ({
              ...param,
              float: param.float
                ? {
                    hasMin: param.float.has_min,
                    hasDefault: param.float.has_default,
                    hasMax: param.float.has_max,
                    min: param.float.min,
                    max: param.float.max,
                    default: param.float.default,
                  }
                : undefined,
            })),
          })),
        })
      );
  },
  async update(payload: UpdateAlertRuleTemplatePayload): Promise<void> {
    return api.post(`${BASE_URL}/Update`, payload);
  },
  async delete(payload: DeleteAlertRuleTemplatePayload): Promise<void> {
    return api.post(`${BASE_URL}/Delete`, payload);
  },
};

import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import {
  TemplatesList,
  UploadAlertRuleTemplatePayload,
  UpdateAlertRuleTemplatePayload,
  DeleteAlertRuleTemplatePayload,
  AlertRuleTemplateGetPayload,
  TemplatesListAPI,
} from './AlertRuleTemplate.types';

const BASE_URL = `/v1/alerting/templates`;

export const AlertRuleTemplateService = {
  async upload(payload: UploadAlertRuleTemplatePayload, token?: CancelToken): Promise<void> {
    return api.post(BASE_URL, payload, false, token);
  },
  async list(payload: AlertRuleTemplateGetPayload, token?: CancelToken): Promise<TemplatesList> {
    return api
      .get<TemplatesListAPI, AlertRuleTemplateGetPayload>(BASE_URL, false, {
        cancelToken: token,
        params: { ...payload },
      })
      .then(
        ({ totals, templates = [] }): TemplatesList => ({
          totals,
          templates: templates.map((template) => ({
            ...template,
            params: template.params?.map((param) => ({
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
    return api.put(`${BASE_URL}/${payload.name}`, { yaml: payload.yaml });
  },
  async delete(payload: DeleteAlertRuleTemplatePayload, token?: CancelToken): Promise<void> {
    return api.delete(`${BASE_URL}/${payload.name}`, false, token);
  },
};

import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import {
  ListServicesBody,
  ListTypesPayload,
  RemoveServiceBody,
  ServiceListPayload,
  UpdateServiceBody,
} from './Services.types';

export const ServicesService = {
  getActive(token?: CancelToken, disableNotifications?: boolean) {
    return api.post<ListTypesPayload, {}>('/v1/inventory/services:getTypes', {}, disableNotifications, token);
  },
  getServices(params: Partial<ListServicesBody> = {}, token?: CancelToken) {
    return api.get<ServiceListPayload, Partial<ListServicesBody>>('/v1/management/services', false, {
      cancelToken: token,
      params,
    });
  },
  removeService(body: RemoveServiceBody, token?: CancelToken) {
    return api.delete<{}>(`/v1/inventory/services/${body.service_id}`, false, token, { force: body.force });
  },
  updateService(body: UpdateServiceBody, token?: CancelToken) {
    const serviceId = body.service_id.replace('/service_id/', '');
    return api.put<{}, UpdateServiceBody>(`/v1/inventory/services/${serviceId}`, body, false, token);
  },
};
